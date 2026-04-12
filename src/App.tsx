import { useState, useEffect, useMemo } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { summarizeTranscription } from './services/geminiService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { FileText, Sparkles, Languages, BookOpen, History, Mic, AlignLeft, AlignRight, Copy, Check, ThumbsUp, ThumbsDown, Send, Trash2, RotateCcw, Download, Loader2, LogIn, LogOut, User, Calendar, Clock, Sun, Moon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { auth, db, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from './lib/translations';

export default function App() {
  const { t, language, setLanguage, isRTL } = useTranslation();
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'compressing' | 'transcribing' | 'summarizing' | 'none'>('none');
  const [activeTab, setActiveTab] = useState('record');
  const [transcriptionDir, setTranscriptionDir] = useState<'ltr' | 'rtl'>('ltr');
  const [summaryDir, setSummaryDir] = useState<'ltr' | 'rtl'>('ltr');
  const [arabicSummaryDir, setArabicSummaryDir] = useState<'ltr' | 'rtl'>('rtl');
  const [processingMode, setProcessingMode] = useState<'both' | 'transcribe' | 'summary'>('both');
  const [copiedTranscription, setCopiedTranscription] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedEnglishSummary, setCopiedEnglishSummary] = useState(false);
  const [copiedArabicSummary, setCopiedArabicSummary] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [primaryLanguage, setPrimaryLanguage] = useState<'mixed' | 'ar' | 'en'>('mixed');
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<Array<{
    id: string;
    timestamp: number;
    transcription: string;
    summary: string;
    mode: string;
    primaryLanguage?: string;
  }>>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore history listener
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'lectures'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any;
      setHistory(docs);
    }, (error) => {
      console.error("Firestore error:", error);
      toast.error(t('failedLoadHistory'));
    });

    return () => unsubscribe();
  }, [user]);

  // Autosave logic (local storage for current session only)
  useEffect(() => {
    const savedTranscription = localStorage.getItem('lecture_scribe_transcription');
    const savedSummary = localStorage.getItem('lecture_scribe_summary');
    const savedMode = localStorage.getItem('lecture_scribe_mode');
    const savedHistory = localStorage.getItem('lecture_scribe_history');

    if (savedTranscription) setTranscription(savedTranscription);
    if (savedSummary) setSummary(savedSummary);
    if (savedMode) setProcessingMode(savedMode as any);
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    if (savedTranscription || savedSummary) {
      toast.info(t('restoredSession'));
      setActiveTab('results');
    }
  }, []);

  useEffect(() => {
    if (transcription) localStorage.setItem('lecture_scribe_transcription', transcription);
    if (summary) localStorage.setItem('lecture_scribe_summary', summary);
    localStorage.setItem('lecture_scribe_mode', processingMode);
    localStorage.setItem('lecture_scribe_history', JSON.stringify(history));
  }, [transcription, summary, processingMode, history]);

  const handleTranscriptionComplete = async (text: string) => {
    setProcessingStep('none');
    setProgress(0);
    if (!text || text.includes("[No clear speech detected]")) {
      setTranscription(text || "[No clear speech detected]");
      setSummary("");
      setActiveTab('results');
      setIsProcessing(false);
      return;
    }

    setTranscription(text);
    
    if (processingMode === 'transcribe') {
      setSummary("");
      setIsProcessing(false);
      setActiveTab('results');
      
      // Add to Firestore if logged in
      if (user) {
        try {
          await addDoc(collection(db, 'lectures'), {
            id: crypto.randomUUID(),
            userId: user.uid,
            timestamp: Date.now(),
            transcription: text,
            summary: "",
            mode: processingMode,
            primaryLanguage
          });
          toast.success(t('savedToHistory'));
        } catch (e) {
          console.error("Error saving to Firestore", e);
        }
      }
      return;
    }

    setIsProcessing(true);
    setProcessingStep('summarizing');
    setProgress(70); // Jump to 70% after transcription
    setSummary(""); // Clear previous summary while processing
    try {
      const { summarizeTranscription } = await import('./services/geminiService');
      const summaryText = await summarizeTranscription(text);
      setSummary(summaryText);
      setProgress(100);
      
      // Add to Firestore if logged in
      if (user) {
        try {
          await addDoc(collection(db, 'lectures'), {
            id: crypto.randomUUID(),
            userId: user.uid,
            timestamp: Date.now(),
            transcription: text,
            summary: summaryText,
            mode: processingMode,
            primaryLanguage
          });
          toast.success(t('savedToHistory'));
        } catch (e) {
          console.error("Error saving to Firestore", e);
        }
      }
      
      setActiveTab('results');
      toast.success(t('summarySuccess'));
    } catch (error) {
      console.error('Summarization failed:', error);
      toast.error('Failed to generate summary. You can try again from the results tab.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('none');
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const clearData = () => {
    setTranscription('');
    setSummary('');
    localStorage.removeItem('lecture_scribe_transcription');
    localStorage.removeItem('lecture_scribe_summary');
    setActiveTab('record');
    toast.success('Session data cleared.');
  };

  const regenerateSummary = async () => {
    if (!transcription) return;
    setIsProcessing(true);
    try {
      const summaryText = await summarizeTranscription(transcription);
      setSummary(summaryText);
      toast.success('Summary regenerated!');
    } catch (error) {
      toast.error('Regeneration failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to clear your entire history? This cannot be undone.")) return;
    
    try {
      // In a real app, we'd use a batch or cloud function to delete all
      // For now, we'll delete them one by one or just inform the user
      toast.info("Clearing history...");
      for (const entry of history) {
        await deleteDoc(doc(db, 'lectures', entry.id));
      }
      toast.success('History cleared.');
    } catch (e) {
      toast.error("Failed to clear history.");
    }
  };

  const loadFromHistory = (entry: typeof history[0]) => {
    setTranscription(entry.transcription);
    setSummary(entry.summary);
    setProcessingMode(entry.mode as any);
    setActiveTab('results');
    toast.success('Loaded from history.');
  };

  const downloadAsFile = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = async (text: string, type: 'transcription' | 'summary' | 'english_summary' | 'arabic_summary') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'transcription') {
        setCopiedTranscription(true);
        setTimeout(() => setCopiedTranscription(false), 2000);
      } else if (type === 'summary') {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2000);
      } else if (type === 'english_summary') {
        setCopiedEnglishSummary(true);
        setTimeout(() => setCopiedEnglishSummary(false), 2000);
      } else if (type === 'arabic_summary') {
        setCopiedArabicSummary(true);
        setTimeout(() => setCopiedArabicSummary(false), 2000);
      }
      const label = type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      toast.success(t('copySuccess', { label }));
    } catch (err) {
      toast.error(t('copyError'));
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
  };

  const submitFeedback = () => {
    setFeedbackSubmitted(true);
    toast.success('Thank you for your feedback!');
    // In a real app, you'd send this to a backend
    console.log('Feedback:', { feedback, comment });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/10 relative overflow-x-hidden">
      {/* Background subtle texture/pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        {/* User Auth Header */}
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="rounded-full h-9 px-3 bg-card/90 backdrop-blur-md border border-border/50 shadow-sm hover:bg-secondary transition-all text-[10px] font-bold uppercase tracking-widest"
            title={language === 'en' ? t('switchArabic') : t('switchEnglish')}
          >
            <Languages className="h-3.5 w-3.5 mr-2" />
            {language === 'en' ? 'العربية' : 'English'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-9 w-9 bg-card/90 backdrop-blur-md border border-border/50 shadow-sm hover:bg-secondary transition-all"
            title={theme === 'light' ? t('switchDarkMode') : t('switchLightMode')}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {isAuthLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : user ? (
            <div className="flex items-center gap-4 bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-border/50">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="h-6 w-6 rounded-full border border-border" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium hidden md:inline-block tracking-tight">{user.displayName}</span>
              </div>
              <div className="w-px h-4 bg-border/60" />
              <Button variant="ghost" size="sm" onClick={logout} className="h-7 text-muted-foreground hover:text-destructive px-2 text-xs font-medium">
                <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </Button>
            </div>
          ) : (
            <Button onClick={signInWithGoogle} variant="outline" className="rounded-full shadow-sm bg-card/90 backdrop-blur-md border-border/50 text-xs font-medium h-9">
              <LogIn className="h-3.5 w-3.5 mr-2" />
              {t('signIn')}
            </Button>
          )}
        </div>

        {/* Header */}
        <header className="mb-16 text-center space-y-6">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-muted-foreground rounded-full text-[10px] font-bold uppercase tracking-[0.2em] border border-border/50"
          >
            <Sparkles className="h-3 w-3" />
            {t('assistantTitle')}
          </motion.div>
          
          <div className="space-y-2">
            <motion.h1
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-6xl font-serif font-medium tracking-tight lg:text-7xl"
            >
              {t('appTitle')}<span className="italic text-muted-foreground/40 font-light">{t('appTitleScribe')}</span>
            </motion.h1>
            <motion.p
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground text-lg max-w-xl mx-auto font-serif italic opacity-80"
            >
              {t('appSubtitle')}
            </motion.p>
          </div>
        </header>

        <main className="space-y-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="bg-secondary/50 border border-border/50 shadow-sm p-1 rounded-full h-11 inline-grid grid-cols-3 w-auto min-w-[300px] sm:min-w-[420px]">
                <TabsTrigger value="record" className="rounded-full text-xs font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
                  <Mic className="h-3.5 w-3.5 mr-2" />
                  {t('record')}
                </TabsTrigger>
                <TabsTrigger value="results" disabled={!transcription} className="rounded-full text-xs font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  {t('results')}
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-full text-xs font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
                  <History className="h-3.5 w-3.5 mr-2" />
                  {t('history')}
                </TabsTrigger>
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              <TabsContent key="record" value="record" className="mt-0">
                <motion.div
                  key="record-content"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-2xl mx-auto"
                >
                  <AudioRecorder
                    onTranscriptionComplete={handleTranscriptionComplete}
                    isProcessing={isProcessing}
                    processingStep={processingStep}
                    onStartProcessing={(step) => {
                      setIsProcessing(true);
                      setProcessingStep(step);
                      setProgress(step === 'compressing' ? 10 : 30);
                    }}
                    onProgressUpdate={setProgress}
                    primaryLanguage={primaryLanguage}
                  />

                  {/* Processing Feedback */}
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-6 w-full space-y-3"
                      >
                        <div className="flex justify-between text-sm font-medium">
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            {processingStep === 'compressing' ? t('optimizingAudio') : 
                             processingStep === 'transcribing' ? t('transcribingLecture') : t('generatingSummary')}
                          </span>
                          <span className="text-primary">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Settings Grid */}
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                    {/* Mode Selection */}
                    <div className="flex flex-col space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">{t('processingMode')}</p>
                      <div className="flex p-1 bg-card border rounded-full shadow-sm w-full">
                        {[
                          { id: 'transcribe', label: t('textMode'), icon: FileText },
                          { id: 'both', label: t('bothMode'), icon: Sparkles },
                          { id: 'summary', label: t('summaryMode'), icon: BookOpen },
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => setProcessingMode(mode.id as any)}
                            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-full text-xs font-medium transition-all ${
                              processingMode === mode.id
                                ? 'bg-primary text-white shadow-md'
                                : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                            }`}
                          >
                            <mode.icon className="h-3.5 w-3.5 mr-1.5" />
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Language Selection */}
                    <div className="flex flex-col space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">{t('primaryLanguage')}</p>
                      <Select value={primaryLanguage} onValueChange={(v: any) => setPrimaryLanguage(v)}>
                        <SelectTrigger className="rounded-full bg-card shadow-sm h-[46px]">
                          <SelectValue placeholder={t('primaryLanguage')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mixed">{t('mixedLang')}</SelectItem>
                          <SelectItem value="ar">{t('arabicOnly')}</SelectItem>
                          <SelectItem value="en">{t('englishOnly')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { icon: Languages, title: t('bilingualSupport'), desc: t('bilingualSupportDesc') },
                      { icon: BookOpen, title: t('techExpertise'), desc: t('techExpertiseDesc') },
                      { icon: History, title: t('instantSummary'), desc: t('instantSummaryDesc') }
                    ].map((feature) => (
                      <div key={feature.title} className="p-6 bg-card rounded-2xl border shadow-sm space-y-3">
                        <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                          <feature.icon className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent key="results" value="results" className="mt-0 space-y-8">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-serif font-medium">{t('sessionAnalysis')}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{t('processedResults')}</p>
                  </div>
                  <div className="flex gap-3">
                    {processingMode !== 'transcribe' && !summary && transcription && !isProcessing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={regenerateSummary}
                        className="rounded-full bg-card shadow-sm border-primary/20 text-primary text-xs font-bold uppercase tracking-widest h-9 px-5"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-2" />
                        {t('generateSummary')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearData}
                      className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-full text-xs font-bold uppercase tracking-widest h-9 px-5"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      {t('clearCurrent')}
                    </Button>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`flex flex-col lg:flex-row gap-8 items-stretch`}
                >
                  {/* Transcription Card */}
                  {(processingMode === 'both' || processingMode === 'transcribe') && (
                    <Card className={`border border-border/50 shadow-sm bg-card rounded-[2rem] overflow-hidden flex flex-col ${processingMode === 'both' ? 'lg:w-1/2' : 'w-full max-w-3xl mx-auto'}`}>
                      <CardHeader className="border-b border-border/40 bg-secondary/20 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {t('transcription')}
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase tracking-widest font-bold opacity-60">{t('fullLectureText')}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-secondary"
                              onClick={() => setTranscriptionDir(prev => prev === 'ltr' ? 'rtl' : 'ltr')}
                              title={transcriptionDir === 'ltr' ? "Switch to RTL" : "Switch to LTR"}
                            >
                              {transcriptionDir === 'ltr' ? <AlignRight className="h-3.5 w-3.5" /> : <AlignLeft className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-secondary"
                              onClick={() => downloadAsFile(transcription, `transcription-${new Date().toISOString().slice(0,10)}.txt`)}
                              title="Download as .txt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-secondary"
                              onClick={() => copyToClipboard(transcription, 'transcription')}
                            >
                              {copiedTranscription ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Badge variant="secondary" className="rounded-full font-mono text-[10px] bg-card border-border/50">
                              {transcription.split(' ').length} {t('words')}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[500px] p-8">
                          <div 
                            className={`prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground/80 font-sans ${transcriptionDir === 'rtl' ? 'text-right' : 'text-left'}`}
                            dir={transcriptionDir}
                          >
                            {transcription}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Summary Card */}
                  {(processingMode === 'both' || processingMode === 'summary') && (
                    <Card className={`border border-border/50 shadow-sm bg-card rounded-[2rem] overflow-hidden flex flex-col ${processingMode === 'both' ? 'lg:w-1/2' : 'w-full max-w-3xl mx-auto'}`}>
                      <CardHeader className="border-b border-border/40 bg-primary/5 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary/60" />
                              {t('aiSummary')}
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase tracking-widest font-bold opacity-60">{t('keyTopics')}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-secondary"
                              onClick={() => downloadAsFile(summary, `summary-${new Date().toISOString().slice(0,10)}.txt`)}
                              title="Download as .txt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 hover:bg-secondary"
                              onClick={() => copyToClipboard(summary, 'summary')}
                            >
                              {copiedSummary ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Badge className="bg-primary text-white rounded-full font-mono text-[10px] uppercase tracking-tighter">
                              {t('bilingualBadge')}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-[500px]">
                          <div className="p-8 space-y-10">
                            {/* English Section */}
                            <div className="space-y-5">
                              <div className="flex items-center justify-between bg-secondary/30 p-4 rounded-2xl border border-border/40">
                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Languages className="h-3.5 w-3.5" />
                                  {t('englishAnalysis')}
                                </h4>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-7 w-7 hover:bg-secondary"
                                    onClick={() => setSummaryDir(prev => prev === 'ltr' ? 'rtl' : 'ltr')}
                                    title={summaryDir === 'ltr' ? "Switch to RTL" : "Switch to LTR"}
                                  >
                                    {summaryDir === 'ltr' ? <AlignRight className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-7 w-7 hover:bg-secondary"
                                    onClick={() => downloadAsFile(summary.split('---ARABIC_SECTION---')[0], `english-summary-${new Date().toISOString().slice(0,10)}.txt`)}
                                    title="Download English only"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full h-7 w-7 hover:bg-secondary"
                                    onClick={() => copyToClipboard(summary.split('---ARABIC_SECTION---')[0], 'english_summary')}
                                  >
                                    {copiedEnglishSummary ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                              <div 
                                className={`markdown-body academic-text text-foreground/90 px-2 ${summaryDir === 'rtl' ? 'text-right' : 'text-left'}`}
                                dir={summaryDir}
                              >
                                <ReactMarkdown>{summary.split('---ARABIC_SECTION---')[0]}</ReactMarkdown>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="relative py-2">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border/40" />
                              </div>
                              <div className="relative flex justify-center">
                                <span className="bg-card px-4 text-[9px] text-muted-foreground/40 font-bold uppercase tracking-[0.4em]">{t('bilingualSplit')}</span>
                              </div>
                            </div>

                            {/* Arabic Section */}
                            {summary.includes('---ARABIC_SECTION---') && (
                              <div className="space-y-5">
                                <div className="flex items-center justify-between bg-primary/5 p-4 rounded-2xl border border-border/40">
                                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Languages className="h-3.5 w-3.5" />
                                    {t('arabicAnalysis')}
                                  </h4>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-full h-7 w-7 hover:bg-secondary"
                                      onClick={() => setArabicSummaryDir(prev => prev === 'ltr' ? 'rtl' : 'ltr')}
                                      title={arabicSummaryDir === 'ltr' ? "Switch to RTL" : "Switch to LTR"}
                                    >
                                      {arabicSummaryDir === 'ltr' ? <AlignRight className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-full h-7 w-7 hover:bg-secondary"
                                      onClick={() => downloadAsFile(summary.split('---ARABIC_SECTION---')[1], `arabic-summary-${new Date().toISOString().slice(0,10)}.txt`)}
                                      title="Download Arabic only"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-full h-7 w-7 hover:bg-secondary"
                                      onClick={() => copyToClipboard(summary.split('---ARABIC_SECTION---')[1], 'arabic_summary')}
                                    >
                                      {copiedArabicSummary ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                  </div>
                                </div>
                                <div 
                                  className={`markdown-body academic-text text-foreground/90 px-2 ${arabicSummaryDir === 'rtl' ? 'text-right' : 'text-left'}`}
                                  dir={arabicSummaryDir}
                                >
                                  <ReactMarkdown>{summary.split('---ARABIC_SECTION---')[1]}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>

                {/* Feedback Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-2xl mx-auto mt-12"
                >
                  <Card className="border-none shadow-lg bg-card rounded-3xl overflow-hidden">
                    <CardContent className="p-8">
                      {!feedbackSubmitted ? (
                        <div className="space-y-6">
                          <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold">{t('howWasResult')}</h3>
                            <p className="text-muted-foreground">{t('feedbackDesc')}</p>
                          </div>
                          
                          <div className="flex justify-center gap-4">
                            <Button
                              variant={feedback === 'positive' ? 'default' : 'outline'}
                              className="rounded-full px-8 h-12"
                              onClick={() => handleFeedback('positive')}
                            >
                              <ThumbsUp className={`h-5 w-5 mr-2 ${feedback === 'positive' ? 'fill-current' : ''}`} />
                              {t('helpful')}
                            </Button>
                            <Button
                              variant={feedback === 'negative' ? 'default' : 'outline'}
                              className="rounded-full px-8 h-12"
                              onClick={() => handleFeedback('negative')}
                            >
                              <ThumbsDown className={`h-5 w-5 mr-2 ${feedback === 'negative' ? 'fill-current' : ''}`} />
                              {t('needsWork')}
                            </Button>
                          </div>

                          {feedback && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="space-y-4"
                            >
                              <Textarea
                                placeholder={t('feedbackPlaceholder')}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="rounded-2xl border-muted min-h-[100px] focus-visible:ring-primary"
                              />
                              <Button
                                className="w-full rounded-full h-12"
                                onClick={submitFeedback}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {t('submitFeedback')}
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-center py-8 space-y-4"
                        >
                          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <Check className="h-8 w-8" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold">{t('feedbackReceived')}</h3>
                            <p className="text-muted-foreground">{t('feedbackThanks')}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            className="rounded-full"
                            onClick={() => {
                              setFeedbackSubmitted(false);
                              setFeedback(null);
                              setComment('');
                            }}
                          >
                            {t('submitAnother')}
                          </Button>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent key="history" value="history" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-serif font-medium">{t('lectureArchive')}</h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('processedSessions')}</p>
                    </div>
                    {history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-full text-xs font-bold uppercase tracking-widest"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {t('clearArchive')}
                      </Button>
                    )}
                  </div>

                  {history.length === 0 ? (
                    <div className="text-center py-24 bg-card rounded-[2rem] border border-dashed border-border/60">
                      <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-muted-foreground font-serif italic">{t('historyEmpty')}</p>
                      <Button 
                        variant="link" 
                        onClick={() => setActiveTab('record')}
                        className="mt-2 text-primary font-bold uppercase tracking-widest text-[10px]"
                      >
                        {t('startFirstSession')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {history.map((item) => (
                        <Card key={item.id} className="group hover:shadow-md transition-all duration-300 border border-border/50 rounded-2xl overflow-hidden bg-card">
                          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                              <div className="h-12 w-12 bg-secondary/50 rounded-xl flex items-center justify-center text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                                {item.summary ? <Sparkles className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-serif font-medium text-lg leading-none">
                                  {t('lectureSession')}
                                </h3>
                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(item.timestamp).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end gap-1 mr-4">
                                <Badge variant="outline" className="rounded-full text-[9px] uppercase tracking-tighter font-mono border-border/50">
                                  {item.mode === 'both' ? t('fullAnalysis') : item.mode === 'summary' ? t('summaryOnly') : t('textOnly')}
                                </Badge>
                                <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">
                                  {item.primaryLanguage === 'ar' ? t('arabic') : item.primaryLanguage === 'en' ? t('english') : t('bilingual')}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full h-9 px-5 text-xs font-bold uppercase tracking-widest border-border/50 hover:bg-primary hover:text-white transition-all"
                                onClick={() => {
                                  setTranscription(item.transcription || '');
                                  setSummary(item.summary || '');
                                  setProcessingMode(item.mode as any);
                                  setActiveTab('results');
                                }}
                              >
                                {t('viewDetails')}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </main>

        <footer className="mt-24 pb-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-6">
            <span className="h-px w-8 bg-border/40" />
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40">{t('academicExcellence')}</p>
            </div>
            <span className="h-px w-8 bg-border/40" />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest">
            {t('footerText')}
          </p>
        </footer>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
