import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Language = 'en' | 'ar';

export const translations = {
  en: {
    // Header
    assistantTitle: "AI-Powered Lecture Assistant",
    appTitle: "Lecture",
    appTitleScribe: "Scribe",
    appSubtitle: "Precision transcription and bilingual summaries for the modern academic.",
    signIn: "Sign in",
    logout: "Logout",
    switchDarkMode: "Switch to Dark Mode",
    switchLightMode: "Switch to Light Mode",
    switchArabic: "Switch to Arabic",
    switchEnglish: "Switch to English",

    // Tabs
    record: "Record",
    results: "Results",
    history: "History",

    // Processing
    optimizingAudio: "Optimizing audio size...",
    transcribingLecture: "Transcribing lecture...",
    generatingSummary: "Generating AI summary...",
    processingPart: "Processing Part {current} of {total}",
    optimizingAudioTitle: "Optimizing Audio",
    transcribingTitle: "Transcribing",
    summarizingTitle: "Summarizing",
    optimizingAudioDesc: "Preparing and segmenting audio for optimal processing...",
    transcribingDesc: "Converting speech to text with Gemini AI...",
    summarizingDesc: "Analyzing key concepts and takeaways...",

    // Settings
    processingMode: "Processing Mode",
    textMode: "Text",
    bothMode: "Both",
    summaryMode: "Summary",
    primaryLanguage: "Primary Language",
    mixedLang: "Mixed (Arabic & English)",
    arabicOnly: "Arabic Only",
    englishOnly: "English Only",

    // Features
    bilingualSupport: "Bilingual Support",
    bilingualSupportDesc: "Seamlessly handles Arabic, English, or a mix.",
    techExpertise: "Tech Domain Expertise",
    techExpertiseDesc: "Identifies core AI and technology principles.",
    instantSummary: "Instant Summary",
    instantSummaryDesc: "Get key takeaways right after recording.",

    // Results
    sessionAnalysis: "Session Analysis",
    processedResults: "Processed results and insights",
    generateSummary: "Generate Summary",
    clearCurrent: "Clear Current",
    transcription: "Transcription",
    fullLectureText: "Full lecture text",
    aiSummary: "AI Summary",
    keyTopics: "Key topics & concepts",
    englishAnalysis: "English Analysis",
    arabicAnalysis: "Arabic Analysis",
    bilingualSplit: "Bilingual Split",
    words: "words",
    bilingualBadge: "Bilingual",

    // Feedback
    howWasResult: "How was the result?",
    feedbackDesc: "Your feedback helps us improve the bilingual transcription quality.",
    helpful: "Helpful",
    needsWork: "Needs Work",
    feedbackPlaceholder: "Any specific issues with Arabic or technical terms? (Optional)",
    submitFeedback: "Submit Feedback",
    feedbackReceived: "Feedback Received!",
    feedbackThanks: "Thank you for helping us refine the lecture transcription experience.",
    submitAnother: "Submit another feedback",

    // History
    lectureArchive: "Lecture Archive",
    processedSessions: "Your processed sessions",
    clearArchive: "Clear Archive",
    historyEmpty: "Your academic history is empty.",
    startFirstSession: "Start your first session",
    lectureSession: "Lecture Session",
    viewDetails: "View Details",
    fullAnalysis: "Full Analysis",
    summaryOnly: "Summary Only",
    textOnly: "Text Only",
    arabic: "Arabic",
    english: "English",
    bilingual: "Bilingual",

    // Audio Recorder
    readyToRecord: "Ready to Record",
    tapToStart: "Tap the microphone to start capturing your lecture.",
    clickToStart: "Click to start recording",
    recording: "Recording...",
    stopRecording: "Stop recording",
    analyzeLecture: "Analyze Lecture",
    audioConfig: "Audio Configuration",
    noiseSuppression: "Noise Suppression",
    echoCancellation: "Echo Cancellation",
    advancedSignal: "Advanced signal processing for high-fidelity academic capture.",
    liveCaptureActive: "Live Capture Active",
    sessionReady: "Session Ready",
    selectMethod: "Select Capture Method",
    discard: "Discard",
    processing: "Processing",
    or: "OR",
    source: "Source",

    // Toasts
    restoredSession: "Restored your last session data.",
    failedLoadHistory: "Failed to load history from database.",
    savedToHistory: "Saved to history!",
    summarySuccess: "Summary generated successfully!",
    copySuccess: "{label} copied to clipboard!",
    copyError: "Failed to copy text.",
    micNotSupported: "Microphone recording is not supported in this browser or environment. Try opening the app in a new tab.",
    micDenied: "Microphone access denied. Please allow microphone access in your browser settings or try opening the app in a new tab.",
    micError: "Could not access microphone. Please ensure your microphone is connected and try again.",
    transcriptionComplete: "Transcription complete!",
    processError: "Failed to process large audio. The file might be too complex or the API is busy.",
    uploadError: "Please upload an audio file (.m4a, .mp3, .wav, etc.)",
    loadedFile: "Loaded: {name}",
    academicExcellence: "Academic Excellence",
    footerText: "© 2024 LectureScribe • Powered by Gemini 1.5 Flash • Secure Academic Environment"
  },
  ar: {
    // Header
    assistantTitle: "مساعد المحاضرات المدعوم بالذكاء الاصطناعي",
    appTitle: "Lecture",
    appTitleScribe: "Scribe",
    appSubtitle: "نسخ دقيق وملخصات ثنائية اللغة للأكاديميين المعاصرين.",
    signIn: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    switchDarkMode: "التبديل إلى الوضع الداكن",
    switchLightMode: "التبديل إلى الوضع الفاتح",
    switchArabic: "التبديل إلى العربية",
    switchEnglish: "التبديل إلى الإنجليزية",

    // Tabs
    record: "تسجيل",
    results: "النتائج",
    history: "السجل",

    // Processing
    optimizingAudio: "تحسين حجم الصوت...",
    transcribingLecture: "نسخ المحاضرة...",
    generatingSummary: "إنشاء ملخص الذكاء الاصطناعي...",
    processingPart: "معالجة الجزء {current} من {total}",
    optimizingAudioTitle: "تحسين الصوت",
    transcribingTitle: "النسخ",
    summarizingTitle: "التلخيص",
    optimizingAudioDesc: "تحضير وتقسيم الصوت للمعالجة المثلى...",
    transcribingDesc: "تحويل الكلام إلى نص باستخدام ذكاء Gemini الاصطناعي...",
    summarizingDesc: "تحليل المفاهيم والنتائج الرئيسية...",

    // Settings
    processingMode: "وضع المعالجة",
    textMode: "نص",
    bothMode: "كلاهما",
    summaryMode: "ملخص",
    primaryLanguage: "اللغة الأساسية",
    mixedLang: "مختلط (عربي وإنجليزي)",
    arabicOnly: "عربي فقط",
    englishOnly: "إنجليزي فقط",

    // Features
    bilingualSupport: "دعم ثنائي اللغة",
    bilingualSupportDesc: "يتعامل بسلاسة مع العربية أو الإنجليزية أو كليهما.",
    techExpertise: "خبرة في المجال التقني",
    techExpertiseDesc: "يحدد مبادئ الذكاء الاصطناعي والتكنولوجيا الأساسية.",
    instantSummary: "ملخص فوري",
    instantSummaryDesc: "احصل على النتائج الرئيسية فور انتهاء التسجيل.",

    // Results
    sessionAnalysis: "تحليل الجلسة",
    processedResults: "النتائج والرؤى المعالجة",
    generateSummary: "إنشاء ملخص",
    clearCurrent: "مسح الحالي",
    transcription: "النص المنسوخ",
    fullLectureText: "نص المحاضرة الكامل",
    aiSummary: "ملخص الذكاء الاصطناعي",
    keyTopics: "المواضيع والمفاهيم الرئيسية",
    englishAnalysis: "التحليل الإنجليزي",
    arabicAnalysis: "التحليل العربي",
    bilingualSplit: "تقسيم ثنائي اللغة",
    words: "كلمة",
    bilingualBadge: "ثنائي اللغة",

    // Feedback
    howWasResult: "كيف كانت النتيجة؟",
    feedbackDesc: "تساعدنا ملاحظاتك في تحسين جودة النسخ ثنائي اللغة.",
    helpful: "مفيد",
    needsWork: "يحتاج إلى تحسين",
    feedbackPlaceholder: "أي مشاكل محددة في المصطلحات العربية أو التقنية؟ (اختياري)",
    submitFeedback: "إرسال الملاحظات",
    feedbackReceived: "تم استلام الملاحظات!",
    feedbackThanks: "شكراً لمساعدتنا في تحسين تجربة نسخ المحاضرات.",
    submitAnother: "إرسال ملاحظة أخرى",

    // History
    lectureArchive: "أرشيف المحاضرات",
    processedSessions: "جلساتك المعالجة",
    clearArchive: "مسح الأرشيف",
    historyEmpty: "سجلك الأكاديمي فارغ.",
    startFirstSession: "ابدأ جلستك الأولى",
    lectureSession: "جلسة محاضرة",
    viewDetails: "عرض التفاصيل",
    fullAnalysis: "تحليل كامل",
    summaryOnly: "ملخص فقط",
    textOnly: "نص فقط",
    arabic: "العربية",
    english: "الإنجليزية",
    bilingual: "ثنائي اللغة",

    // Audio Recorder
    readyToRecord: "جاهز للتسجيل",
    tapToStart: "اضغط على الميكروفون لبدء تسجيل محاضرتك.",
    clickToStart: "انقر لبدء التسجيل",
    recording: "جاري التسجيل...",
    stopRecording: "إيقاف التسجيل",
    analyzeLecture: "تحليل المحاضرة",
    audioConfig: "إعدادات الصوت",
    noiseSuppression: "تقليل الضوضاء",
    echoCancellation: "إلغاء الصدى",
    advancedSignal: "معالجة إشارات متقدمة لالتقاط أكاديمي عالي الدقة.",
    liveCaptureActive: "الالتقاط المباشر نشط",
    sessionReady: "الجلسة جاهزة",
    selectMethod: "اختر طريقة الالتقاط",
    discard: "تجاهل",
    processing: "جاري المعالجة",
    or: "أو",
    source: "المصدر",

    // Toasts
    restoredSession: "تم استعادة بيانات جلستك الأخيرة.",
    failedLoadHistory: "فشل تحميل السجل من قاعدة البيانات.",
    savedToHistory: "تم الحفظ في السجل!",
    summarySuccess: "تم إنشاء الملخص بنجاح!",
    copySuccess: "تم نسخ {label} إلى الحافظة!",
    copyError: "فشل نسخ النص.",
    micNotSupported: "تسجيل الميكروفون غير مدعوم في هذا المتصفح. جرب فتح التطبيق في علامة تبويب جديدة.",
    micDenied: "تم رفض الوصول إلى الميكروفون. يرجى السماح بالوصول في إعدادات المتصفح.",
    micError: "تعذر الوصول إلى الميكروفون. يرجى التأكد من توصيله والمحاولة مرة أخرى.",
    transcriptionComplete: "اكتمل النسخ!",
    processError: "فشل معالجة الصوت الكبير. قد يكون الملف معقداً جداً أو الواجهة مشغولة.",
    uploadError: "يرجى تحميل ملف صوتي (.m4a, .mp3, .wav, إلخ)",
    loadedFile: "تم تحميل: {name}",
    academicExcellence: "التميز الأكاديمي",
    footerText: "© 2024 LectureScribe • مدعوم بـ Gemini 1.5 Flash • بيئة أكاديمية آمنة"
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en, params?: Record<string, any>) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language');
      if (saved === 'en' || saved === 'ar') return saved;
      return window.navigator.language.startsWith('ar') ? 'ar' : 'en';
    }
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: keyof typeof translations.en, params?: Record<string, any>) => {
    let text = translations[language][key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
