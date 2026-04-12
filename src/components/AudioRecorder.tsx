import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Volume2, Trash2, Upload, Settings2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/src/lib/translations';

interface AudioRecorderProps {
  onTranscriptionComplete: (transcription: string) => void;
  isProcessing: boolean;
  processingStep: 'compressing' | 'transcribing' | 'summarizing' | 'none';
  onStartProcessing: (step: 'compressing' | 'transcribing') => void;
  onProgressUpdate?: (progress: number) => void;
  primaryLanguage?: string;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete,
  isProcessing,
  processingStep,
  onStartProcessing,
  onProgressUpdate,
  primaryLanguage = 'mixed',
}) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [chunkProgress, setChunkProgress] = useState<{current: number, total: number} | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error(t('micNotSupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: echoCancellation,
          noiseSuppression: noiseSuppression,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000 // 64kbps is excellent for speech
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);
      setAudioBlob(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        toast.error(t('micDenied'), {
          duration: 6000,
        });
      } else {
        toast.error(t('micError'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;

    onStartProcessing('compressing');
    setChunkProgress(null);
    try {
      const { chunkAudio } = await import('@/src/lib/audioUtils');
      const { transcribeAudio } = await import('@/src/services/geminiService');
      
      // Split into 5-minute chunks for reliability
      const chunks = await chunkAudio(audioBlob, 300);
      setChunkProgress({ current: 0, total: chunks.length });
      
      onStartProcessing('transcribing');
      let fullTranscription = '';

      for (let i = 0; i < chunks.length; i++) {
        setChunkProgress({ current: i + 1, total: chunks.length });
        
        // Update main progress bar (from 30% to 80%)
        if (onProgressUpdate) {
          const chunkProgressVal = 30 + Math.round(((i + 1) / chunks.length) * 50);
          onProgressUpdate(chunkProgressVal);
        }
        
        const chunk = chunks[i];
        const base64Audio = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(chunk);
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        });

        const chunkText = await transcribeAudio(base64Audio, chunk.type, primaryLanguage);
        
        // Append with spacing, avoiding duplicate error messages
        if (chunkText && !chunkText.includes("[No clear speech detected]")) {
          fullTranscription += (fullTranscription ? '\n\n' : '') + chunkText;
        }

        // Add a small delay between chunks to stay under RPM limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (!fullTranscription) {
        fullTranscription = "[No clear speech detected in any part of the recording]";
      }

      onTranscriptionComplete(fullTranscription);
      toast.success(t('transcriptionComplete'));
      setChunkProgress(null);
    } catch (err) {
      console.error('Processing error:', err);
      toast.error(t('processError'));
      setChunkProgress(null);
    }
  };

  const clearRecording = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.endsWith('.m4a')) {
      toast.error(t('uploadError'));
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    setRecordingTime(0);
    toast.success(t('loadedFile', { name: file.name }));
  };

  return (
    <div className="flex flex-col items-center gap-8 p-10 bg-card rounded-[2rem] border border-border/50 shadow-sm relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/30 to-transparent pointer-events-none" />

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-card/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="h-32 w-32 bg-primary/5 rounded-full flex items-center justify-center border border-primary/10"
              >
                <div className="h-24 w-24 bg-primary/5 rounded-full flex items-center justify-center border border-primary/5">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
              </motion.div>
            </div>
            <div className="mt-8 space-y-3">
              <h3 className="text-xl font-serif font-medium tracking-tight text-primary">
                {processingStep === 'compressing' ? t('optimizingAudioTitle') : 
                 processingStep === 'transcribing' ? t('transcribingTitle') : t('summarizingTitle')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed italic font-serif">
                {processingStep === 'compressing' ? t('optimizingAudioDesc') : 
                 processingStep === 'transcribing' ? t('transcribingDesc') : t('summarizingDesc')}
              </p>
              {processingStep === 'transcribing' && chunkProgress && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60">
                    {t('processingPart', { current: chunkProgress.current, total: chunkProgress.total })}
                  </p>
                  <div className="w-40 h-1 bg-secondary rounded-full overflow-hidden mx-auto">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
                      transition={{ type: "spring", stiffness: 50 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isRecording && !audioUrl && (
        <div className="text-center space-y-2 mb-4 relative z-10">
          <h3 className="text-xl font-serif font-medium">{t('readyToRecord')}</h3>
          <p className="text-sm text-muted-foreground italic font-serif opacity-70">{t('tapToStart')}</p>
        </div>
      )}

      <div className="flex items-center gap-6 w-full justify-center relative z-10">
        <div className="relative group">
          <AnimatePresence mode="wait">
            {isRecording && (
              <motion.div
                key="recording-indicator"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute -inset-6 bg-destructive/5 rounded-full animate-pulse"
              />
            )}
          </AnimatePresence>
          
          <Button
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className={`h-24 w-24 rounded-full shadow-xl relative z-10 transition-all duration-500 ${isRecording ? 'scale-110 shadow-destructive/20' : 'hover:scale-105 shadow-primary/10'}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isRecording ? (
              <Square className="h-10 w-10 fill-current" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </Button>
        </div>

        {!isRecording && !audioUrl && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-px w-10 bg-border/60" />
            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">{t('or')}</span>
            <div className="h-px w-10 bg-border/60" />
          </div>
        )}

        {!isRecording && !audioUrl && (
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="lg"
              className="h-24 w-24 rounded-full border-dashed border-2 border-border/60 hover:border-primary hover:bg-primary/5 transition-all group"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>

            {/* Mic Settings */}
            <Popover>
              <PopoverTrigger className="h-12 w-12 rounded-full text-muted-foreground hover:text-primary hover:bg-secondary flex items-center justify-center transition-all disabled:opacity-50 disabled:pointer-events-none border border-border/40">
                <Settings2 className="h-5 w-5" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-5 rounded-3xl shadow-2xl border border-border/50 bg-card/95 backdrop-blur-sm">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-medium text-base">{t('audioConfig')}</h4>
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <Label htmlFor="noise-suppression" className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors cursor-pointer">{t('noiseSuppression')}</Label>
                      <Switch
                        id="noise-suppression"
                        checked={noiseSuppression}
                        onCheckedChange={setNoiseSuppression}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between group">
                      <Label htmlFor="echo-cancellation" className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors cursor-pointer">{t('echoCancellation')}</Label>
                      <Switch
                        id="echo-cancellation"
                        checked={echoCancellation}
                        onCheckedChange={setEchoCancellation}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed italic font-serif">
                    {t('advancedSignal')}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="audio/*,.m4a"
          className="hidden"
        />
      </div>

      <div className="text-center space-y-3 relative z-10">
        <p className="text-4xl font-mono font-light tracking-tighter text-primary/90">
          {formatTime(recordingTime)}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
          {isRecording 
            ? t('recording') 
            : audioUrl 
              ? (audioBlob instanceof File ? `${t('source')}: ${audioBlob.name}` : t('sessionReady'))
              : t('selectMethod')}
        </p>
      </div>

      {audioUrl && !isRecording && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-6 w-full relative z-10"
        >
          <div className="w-full max-w-md bg-secondary/50 p-2 rounded-2xl border border-border/40">
            <audio src={audioUrl} controls className="w-full h-10" />
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRecording}
              disabled={isProcessing}
              className="rounded-full text-xs font-bold uppercase tracking-widest hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {t('discard')}
            </Button>
            <Button
              onClick={handleTranscribe}
              disabled={isProcessing}
              className="rounded-full px-10 h-11 text-xs font-bold uppercase tracking-[0.2em] shadow-xl shadow-primary/20 bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 mr-2" />
                  {t('analyzeLecture')}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
