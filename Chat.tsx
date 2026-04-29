import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Phone, MoreVertical, Search, Paperclip, Mic } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { chatWithGemini, blobToGenerativePart } from '../lib/gemini';
import { VoiceRecorder } from './VoiceRecorder';
import { Part } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isAudio?: boolean;
  audioUrl?: string;
  timestamp: Date;
}

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: '**نادرا معلوماتی ایپ** میں خوش آمدید۔\n\nاپنی زبان منتخب کریں:\n\n1. English کے لیے **1** ٹائپ کریں۔\n2. اردو کے لیے **2** ٹائپ کریں۔',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionStep, setSessionStep] = useState<'language' | 'categories' | 'submenu' | 'chat'>('language');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isEnglish, setIsEnglish] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getSubMenuContent = (category: string, english: boolean) => {
    if (english) {
      switch (category) {
        case '1': return '🪪 **Identity Related Services:**\n\n1. CNIC Issuance\n2. Smart CNIC (SNIC)\n3. Juvenile Card (under 18)\n4. NICOP (Overseas Pakistanis)\n5. POC (Pakistan Origin Card)\n6. Renewal / Modification / Duplicate';
        case '2': return '👶 **Family Registration Services:**\n\n1. Child Registration (B-Form)\n2. Family Registration Certificate (FRC)\n3. Marriage Registration Update\n4. Divorce Registration Update';
        case '3': return '🌍 **Overseas Pakistanis Services:**\n\n1. NICOP Issuance & Renewal\n2. POC Services\n3. Online Pak-Identity Portal Access';
        case '4': return '🏢 **Corporate / Verification Services:**\n\n1. Biometric Verification\n2. Bank & Telecom Verification\n3. e-Sahulat Services (Utility bills, top-ups)';
        case '5': return '🗳️ **Election Related Services:**\n\n1. Voter Registration & Verification\n2. Electoral Roll Updates';
        case '6': return '📄 **Other Services:**\n\n1. Data Modification (Name, Address)\n2. Lost CNIC Replacement\n3. Token & Appointment System\n4. Home-based NADRA Service';
        default: return '';
      }
    } else {
      switch (category) {
        case '1': return '🪪 **شناختی کارڈ سے متعلق خدمات:**\n\n1. شناختی کارڈ کا نیا اجراء\n2. سمارٹ کارڈ کا حصول\n3. بچوں کے لیے رجسٹریشن (جووینائل کارڈ)\n4. سمندر پار پاکستانیوں کے لیے نائیکوپ کارڈ\n5. پی او سی (پاکستان اوریجن کارڈ)\n6. کارڈ کی تجدید، تبدیلی یا دوسری کاپی';
        case '2': return '👶 **خاندانی رجسٹریشن کی خدمات:**\n\n1. کمپیوٹرائزڈ بی فارم (بچوں کی رجسٹریشن)\n2. خاندانی رجسٹریشن سرٹیفکیٹ (ایف آر سی)\n3. نکاح یا شادی کا ریکارڈ اپ ڈیٹ کرنا\n4. طلاق کی رجسٹریشن کا ریکارڈ';
        case '3': return '🌍 **سمندر پار پاکستانیوں کی خدمات:**\n\n1. نائیکوپ کارڈ کا اجراء اور تجدید\n2. پی او سی کی خدمات\n3. آن لائن پاک آئیڈنٹیٹی پورٹل کا استعمال';
        case '4': return '🏢 **تصدیقی خدمات:**\n\n1. بائیو میٹرک تصدیق\n2. بینک اور موبائل سم کے لیے تصدیق\n3. ای-سہولت کے ذریعے بلوں کی ادائیگی اور رقوم کی منتقلی';
        case '5': return '🗳️ **انتخابات سے متعلق معلومات:**\n\n1. ووٹر لسٹ میں نام چیک کرنا\n2. ووٹ کے اندراج یا منتقلی کا طریقہ';
        case '6': return '📄 **دیگر متفرق خدمات:**\n\n1. کوائف میں تبدیلی (نام، پتہ وغیرہ)\n2. گمشدہ شناختی کارڈ کا دوبارہ حصول\n3. ٹوکن اور اپوائنٹمنٹ کی معلومات\n4. گھر بیٹھے نادرا سروس کی تفصیلات';
        default: return '';
      }
    }
  };

  const handleSend = async (text?: string, audioPart?: Part, audioBlob?: Blob) => {
    const content = text?.trim() || (audioPart ? "Audio Message" : "");
    if (!content && !audioPart) return;

    let audioUrl: string | undefined;
    if (audioBlob) {
      audioUrl = URL.createObjectURL(audioBlob);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      isAudio: !!audioPart,
      audioUrl: audioUrl,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const isBackCommand = text === '0';

    // 1. Handle Navigation Commands (Back)
    if (isBackCommand) {
      handleBackNavigation();
      return;
    }

    // 2. Handle Language Selection
    if (sessionStep === 'language' && !audioPart) {
      if (text === '1') {
        setLanguage(true);
        return;
      } else if (text === '2') {
        setLanguage(false);
        return;
      }
    }

    // 3. Handle Category Selection
    if (sessionStep === 'categories' && !audioPart && text) {
      const subMenuContent = getSubMenuContent(text, isEnglish);
      if (subMenuContent) {
        setCategory(text, subMenuContent);
        return;
      }
    }

    // 4. Handle Sub-menu Selection
    let finalPrompt = content;
    if (sessionStep === 'submenu' && !audioPart && text && /^\d+$/.test(text)) {
      const selectedService = getServiceFromSubMenu(text);
      if (selectedService) {
        finalPrompt = isEnglish 
          ? `I want to know details about: ${selectedService}` 
          : `${selectedService} کے بارے میں تفصیل سے بتائیں۔`;
        setSessionStep('chat');
      }
    }

    // 5. General AI Interaction
    await callGemini(finalPrompt, audioPart);
  };

  const handleBackNavigation = () => {
    if (sessionStep === 'categories') {
      showWelcomeMessage();
      setSessionStep('language');
    } else if (sessionStep === 'submenu' || sessionStep === 'chat') {
      showMenuMessage();
      setSessionStep('categories');
    }
    setIsProcessing(false);
  };

  const setLanguage = (english: boolean) => {
    setIsEnglish(english);
    const content = english 
      ? 'Great! You have selected **English**. \n\nPlease select a category (Type the number): \n\n1. 🪪 **Identity Related Services** (Type **1**)\n2. 👶 **Family Registration Services** (Type **2**)\n3. 🌍 **Overseas Pakistanis Services** (Type **3**)\n4. 🏢 **Corporate / Verification Services** (Type **4**)\n5. 🗳️ **Election Related Services** (Type **5**)\n6. 📄 **Other Services** (Type **6**)\n\nType **0** to go back to language selection.'
      : 'شکریہ! آپ نے **اردو** منتخب کی ہے۔\n\nنادرا کی خدمات کے لیے درج ذیل میں سے ایک منتخب کریں (نمبر ٹائپ کریں):\n\n1. 🪪 **شناختی کارڈ سے متعلق خدمات** (**1** ٹائپ کریں)\n2. 👶 **خاندانی رجسٹریشن کی خدمات** (**2** ٹائپ کریں)\n3. 🌍 **سمندر پار پاکستانیوں کی خدمات** (**3** ٹائپ کریں)\n4. 🏢 **تصدیقی خدمات** (**4** ٹائپ کریں)\n5. 🗳️ **انتخابات سے متعلق معلومات** (**5** ٹائپ کریں)\n6. 📄 **دیگر خدمات** (**6** ٹائپ کریں)\n\nزبان تبدیل کرنے کے لیے **0** ٹائپ کریں۔';
    
    addBotMessage(content);
    setSessionStep('categories');
    setIsProcessing(false);
  };

  const setCategory = (catId: string, subMenuContent: string) => {
    setSelectedCategory(catId);
    const content = subMenuContent + (isEnglish 
      ? '\n\nType a service number (1, 2, etc.) for details, or ask a question. Type **0** to go back.' 
      : '\n\nتفصیل جاننے کے لیے سروس کا نمبر (1، 2، وغیرہ) لکھیں، یا کوئی سوال پوچھیں۔ واپس جانے کے لیے **0** ٹائپ کریں۔');
    
    addBotMessage(content);
    setSessionStep('submenu');
    setIsProcessing(false);
  };

  const showWelcomeMessage = () => {
    addBotMessage('**نادرا معلوماتی ایپ** میں خوش آمدید۔\n\nاپنی زبان منتخب کریں:\n\n1. English کے لیے **1** ٹائپ کریں۔\n2. اردو کے لیے **2** ٹائپ کریں۔');
  };

  const showMenuMessage = () => {
    const content = isEnglish 
      ? 'Please select a category:\n\n1. 🪪 **Identity Services** (Type **1**)\n2. 👶 **Family Services** (Type **2**)\n3. 🌍 **Overseas Services** (Type **3**)\n4. 🏢 **Verification Services** (Type **4**)\n5. 🗳️ **Election Info** (Type **5**)\n6. 📄 **Other Services** (Type **6**)\n\nType **0** to change language.'
      : 'نادرا کی خدمات کے لیے منتخب کریں:\n\n1. 🪪 **شناختی کارڈ خدمات** (**1** ٹائپ کریں)\n2. 👶 **خاندانی خدمات** (**2** ٹائپ کریں)\n3. 🌍 **سمندر پار پاکستانی خدمات** (**3** ٹائپ کریں)\n4. 🏢 **تصدیقی خدمات** (**4** ٹائپ کریں)\n5. 🗳️ **انتخابات معلومات** (**5** ٹائپ کریں)\n6. 📄 **دیگر خدمات** (**6** ٹائپ کریں)\n\nزبان کے لیے **0** لکھیں۔';
    addBotMessage(content);
  };

  const getServiceFromSubMenu = (text: string) => {
    const subMenu = getSubMenuContent(selectedCategory || '', isEnglish);
    const lines = subMenu.split('\n').filter(l => l.trim().match(/^\d+\./));
    const selection = parseInt(text) - 1;
    if (selection >= 0 && selection < lines.length) {
      return lines[selection].replace(/^\d+\.\s*/, '').trim();
    }
    return null;
  };

  const addBotMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      role: 'model',
      content,
      timestamp: new Date()
    }]);
  };

  const callGemini = async (prompt: string, audioPart?: Part) => {
    try {
      const history = messages.map(m => ({ 
        role: m.role, 
        content: m.content 
      }));

      const contextPrompt = audioPart 
        ? (!isEnglish 
            ? "آپ ایک ماہر نادرا معاون ہیں۔ اس آڈیو پیغام کو غور سے سنیں جو اردو، پنجابی، سندھی یا رومن اردو میں ہو سکتا ہے۔ اس کا جواب صرف اردو میں دیں اور درست معلومات فراہم کریں۔ اگر ضرورت ہو تو معلومات درج ذیل کیٹیگریز سے حاصل کریں (Identity, Family, Overseas, Verification, Election)۔ آخر میں بتائیں کہ مینو میں واپس جانے کے لیے 0 ٹائپ کریں۔" 
            : "You are an expert NADRA assistant. Listen carefully to this audio message (which might be in English or Roman Urdu). Provide a clear, professional response in English. At the end, mention to type 0 to go back to the menu.")
        : prompt;

      const response = await chatWithGemini([...history, { 
        role: 'user', 
        content: audioPart ? [audioPart, { text: contextPrompt }] : contextPrompt 
      }]);
      
      const footer = !isEnglish ? '\n\n--- \nواپس جانے کے لیے **0** ٹائپ کریں۔' : '\n\n--- \nType **0** to go back.';
      addBotMessage(response + footer);
      setSessionStep('chat');
    } catch (error) {
      console.error('Chat error:', error);
      addBotMessage(isEnglish ? 'Something went wrong. Please try again.' : 'کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAudioComplete = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const audioPart = await blobToGenerativePart(blob);
      await handleSend(undefined, audioPart, blob);
    } catch (error) {
      console.error('Audio processing failed:', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-[#efeae2] shadow-2xl overflow-hidden font-sans border-x border-gray-200">
      {/* Header */}
      <div className="bg-[#075e54] text-white p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center p-1 border border-white/30">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/e/ef/Government_of_Pakistan_logo.svg" 
                alt="Govt Logo" 
                className="w-full h-full object-contain brightness-0 invert"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075e54] rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">NADRA Maloomati App</h1>
            <p className="text-[10px] text-emerald-100 flex items-center gap-1">
              Online Assistant • Procedures Experts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-emerald-50">
          <Search className="w-5 h-5 cursor-pointer hover:text-white" />
          <Phone className="w-5 h-5 cursor-pointer hover:text-white" />
          <MoreVertical className="w-5 h-5 cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-95"
      >
        <div className="flex justify-center mb-6">
          <span className="bg-[#dcf8c6] text-[10px] px-3 py-1 rounded-lg text-gray-600 shadow-sm font-medium">
            MESSAGES ARE END-TO-END AI GENERATED
          </span>
        </div>

        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex w-full group",
                m.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2 rounded-xl shadow-sm relative text-sm",
                  m.role === 'user' 
                    ? "bg-[#dcf8c6] text-gray-800 rounded-tr-none" 
                    : "bg-white text-gray-800 rounded-tl-none"
                )}
              >
                {/* Arrow pointer */}
                <div className={cn(
                  "absolute top-0 w-2 h-2",
                  m.role === 'user' 
                    ? "right-0 translate-x-1/2 -mr-1" 
                    : "left-0 -translate-x-1/2 -ml-1"
                )}>
                  <div className={cn(
                    "w-full h-full rotate-45",
                    m.role === 'user' ? "bg-[#dcf8c6]" : "bg-white"
                  )} />
                </div>

                <div 
                  className={cn(
                    "prose prose-sm max-w-none text-[13px] leading-relaxed overflow-hidden",
                    !isEnglish && "font-urdu text-right"
                  )}
                  dir="auto"
                >
                  {m.isAudio ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <Mic className="w-4 h-4" />
                        <span className="text-[11px] font-medium uppercase tracking-wider">Voice Note</span>
                      </div>
                      {m.audioUrl && (
                        <audio controls className="h-8 w-full filter hue-rotate-90 contrast-125">
                          <source src={m.audioUrl} type="audio/webm" />
                        </audio>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-emerald-600/70 italic bg-emerald-50/50 p-1 rounded-md">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span>{isEnglish ? "Transcribing & analyzing..." : "آواز کا تجزیہ کیا جا رہا ہے..."}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  )}
                  

                </div>
                
                <div className="flex justify-end items-center gap-1 mt-1 opacity-50 text-[9px]">
                  <span>{m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {m.role === 'user' && (
                    <div className="flex text-emerald-500">
                      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 5L5 9L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 5L9 8L11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isProcessing && (
          <div className="flex justify-start items-center gap-3 ml-2">
            <div className="bg-white px-4 py-3 rounded-2xl shadow-sm rounded-tl-none border border-emerald-50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                </div>
                <span className="text-[11px] font-medium text-emerald-600/80 uppercase tracking-tighter">
                  {isEnglish ? "NADRA Assistant is thinking..." : "نادرا اسسٹنٹ سوچ رہا ہے..."}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-2 bg-[#f0f2f5] flex items-center gap-2 border-t border-gray-200">
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
          <Paperclip className="w-5 h-5" />
        </button>
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder={isEnglish ? "Type your question..." : "سوال لکھیں..."}
            dir="auto"
            className="w-full bg-white rounded-full px-4 py-2 text-sm focus:outline-none shadow-sm placeholder:text-gray-400"
            disabled={isProcessing}
          />
        </div>

        {input.trim() ? (
          <button
            onClick={() => handleSend(input)}
            disabled={isProcessing}
            className="w-10 h-10 bg-[#00a884] text-white rounded-full flex items-center justify-center hover:bg-[#008f6f] transition-all active:scale-95 shadow-md"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        ) : (
          <VoiceRecorder 
            onRecordingComplete={handleAudioComplete} 
            isProcessing={isProcessing} 
          />
        )}
      </div>
    </div>
  );
};
