
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, ChildProfile, AppView } from './types';
import { INITIAL_PROFILES, SRS_INTERVALS } from './constants';
import { fetchCharacterDetails, fetchBulkCharacterDetails } from './geminiService';

export default function App() {
  const [profiles, setProfiles] = useState<ChildProfile[]>(INITIAL_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('HOME');
  const [loading, setLoading] = useState(false);
  const [recordTab, setRecordTab] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [bulkStage, setBulkStage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);

  // 稳健的持久化存储加载
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chinese-srs-data-v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved data", e);
    }
  }, []);

  // 数据变更同步
  useEffect(() => {
    localStorage.setItem('chinese-srs-data-v2', JSON.stringify(profiles));
  }, [profiles]);

  const activeProfile = useMemo(() => 
    profiles.find(p => p.id === activeProfileId) || null, 
    [profiles, activeProfileId]
  );

  const dueCards = useMemo(() => {
    if (!activeProfile) return [];
    const now = Date.now();
    return activeProfile.cards
      .filter(c => c.nextReviewDate <= now)
      .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
  }, [activeProfile]);

  // 头像上传逻辑
  const handleAvatarClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUploadingForId(id);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingForId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfiles(prev => prev.map(p => 
          p.id === uploadingForId ? { ...p, avatar: base64String } : p
        ));
      };
      reader.readAsDataURL(file);
    }
    setUploadingForId(null);
  };

  const renderAvatar = (p: ChildProfile | null, sizeClass: string = "w-24 h-24 text-6xl") => {
    if (!p) return null;
    const isImage = p.avatar && (p.avatar.startsWith('data:image') || p.avatar.length > 10);
    return (
      <div className={`${sizeClass} bg-slate-100 rounded-3xl flex items-center justify-center shadow-inner ring-4 ring-slate-50 overflow-hidden relative group`}>
        {isImage ? (
          <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <span className="select-none">{p.avatar || '👶'}</span>
        )}
        <div 
          onClick={(e) => handleAvatarClick(e, p.id)}
          className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
        >
          <span className="text-white text-[10px] font-bold bg-black/40 px-2 py-1 rounded">修改</span>
        </div>
      </div>
    );
  };

  const handleAddCharacter = async (char: string) => {
    if (!char || !activeProfileId) return;
    setLoading(true);
    const details = await fetchCharacterDetails(char);
    
    const newCard: Flashcard = {
      id: Date.now().toString(),
      character: char,
      pinyin: details.pinyin || "",
      meaning: details.meaning || "",
      srsStage: 0,
      nextReviewDate: Date.now(), 
      createdAt: Date.now()
    };

    setProfiles(prev => prev.map(p => 
      p.id === activeProfileId ? { ...p, cards: [newCard, ...p.cards] } : p
    ));
    setLoading(false);
    setView('HOME');
  };

  const handleBulkAdd = async (text: string) => {
    if (!text || !activeProfileId) return;
    setLoading(true);
    
    const chars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const uniqueChars = Array.from(new Set(chars));
    
    if (uniqueChars.length === 0) {
      setLoading(false);
      return;
    }

    const batchSize = 10;
    const allResults = [];
    
    for (let i = 0; i < uniqueChars.length; i += batchSize) {
      const batch = uniqueChars.slice(i, i + batchSize);
      const details = await fetchBulkCharacterDetails(batch);
      allResults.push(...details);
    }

    const newCards: Flashcard[] = allResults.map((item: any, idx) => ({
      id: `${Date.now()}-${idx}`,
      character: item.character,
      pinyin: item.pinyin,
      meaning: item.meaning,
      srsStage: bulkStage,
      nextReviewDate: Date.now(),
      createdAt: Date.now()
    }));

    setProfiles(prev => prev.map(p => 
      p.id === activeProfileId ? { ...p, cards: [...newCards, ...p.cards] } : p
    ));
    
    setLoading(false);
    setView('HOME');
    setRecordTab('SINGLE');
  };

  const handleReview = (cardId: string, known: boolean) => {
    setProfiles(prev => prev.map(p => {
      if (p.id !== activeProfileId) return p;
      return {
        ...p,
        cards: p.cards.map(c => {
          if (c.id !== cardId) return c;
          
          if (known) {
            const nextStage = Math.min(c.srsStage + 1, SRS_INTERVALS.length - 1);
            const nextInterval = SRS_INTERVALS[nextStage];
            return {
              ...c,
              srsStage: nextStage,
              nextReviewDate: Date.now() + (nextInterval > 0 ? nextInterval * 86400000 : 0)
            };
          } else {
            return {
              ...c,
              srsStage: 0,
              nextReviewDate: Date.now() 
            };
          }
        })
      };
    }));
  };

  // 主页渲染
  if (view === 'HOME' || !activeProfileId || !activeProfile) {
    return (
      <div className="max-w-6xl mx-auto min-h-screen bg-slate-50 p-8 sm:p-12">
        <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
        <header className="text-center mb-16">
          <h1 className="text-4xl font-black text-slate-800 tracking-tight">识字复习助手</h1>
          <p className="text-sm text-slate-400 mt-3 font-medium tracking-widest uppercase">Ebbinghaus Science-Based Learning</p>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {profiles.map(p => (
            <div key={p.id} className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                  {renderAvatar(p)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-3xl font-bold text-slate-800">{p.name}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.id === '1' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                        {p.id === '1' ? '姐姐' : '弟弟'}
                      </span>
                    </div>
                    <p className="text-lg text-slate-500 font-medium mt-1">字库总量: {p.cards?.length || 0} 字</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setActiveProfileId(p.id); setView('RECORD'); }}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all hover:bg-indigo-700"
                >
                  管理识字
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <button 
                  disabled={!p.cards || p.cards.length === 0}
                  onClick={() => { setActiveProfileId(p.id); setView('LEARN'); }}
                  className={`py-6 rounded-3xl font-bold flex flex-col items-center justify-center transition-all ${
                    p.cards && p.cards.some(c => c.nextReviewDate <= Date.now()) 
                    ? 'bg-rose-500 text-white shadow-xl shadow-rose-200' 
                    : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="text-2xl mb-1">开始复习</span>
                  <span className="text-xs opacity-90 font-bold uppercase tracking-wider">
                    待复习: {p.cards ? p.cards.filter(c => c.nextReviewDate <= Date.now()).length : 0} 字
                  </span>
                </button>
                <button 
                  onClick={() => { setActiveProfileId(p.id); setView('LIST'); }}
                  className="py-6 bg-white border-2 border-slate-100 text-slate-600 rounded-3xl text-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center"
                >
                  查阅字库
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 子页面通用导航
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-white border-b py-6 px-10 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <button 
          onClick={() => setView('HOME')} 
          className="text-slate-500 font-bold px-6 py-2 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-2"
        >
          <span className="text-xl">←</span> 返回首页
        </button>
        <div className="flex items-center gap-4 bg-indigo-50 px-6 py-2 rounded-full border border-indigo-100">
          {renderAvatar(activeProfile, "w-10 h-10 text-xl")}
          <span className="font-bold text-indigo-700 text-lg">正在为 {activeProfile.name} 管理</span>
        </div>
        <div className="w-24"></div>
      </div>

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-8 sm:p-12">
        {view === 'RECORD' && (
          <div className="max-w-3xl mx-auto w-full py-6">
            <h2 className="text-4xl font-black text-slate-800 text-center mb-4">导入学习记录</h2>
            
            <div className="flex justify-center gap-4 mb-8 p-1 bg-slate-100 rounded-2xl w-fit mx-auto">
              <button 
                onClick={() => setRecordTab('SINGLE')}
                className={`px-8 py-3 rounded-xl font-bold transition-all ${recordTab === 'SINGLE' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
              >
                单个录入
              </button>
              <button 
                onClick={() => setRecordTab('BULK')}
                className={`px-8 py-3 rounded-xl font-bold transition-all ${recordTab === 'BULK' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
              >
                批量导入
              </button>
            </div>

            <div className="bg-white p-10 rounded-[50px] shadow-2xl shadow-indigo-50/50 border border-slate-50">
              {recordTab === 'SINGLE' ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as any).char;
                  handleAddCharacter(input.value);
                  input.value = '';
                }}>
                  <input 
                    name="char"
                    autoFocus
                    autoComplete="off"
                    className="w-full text-9xl text-center p-16 border-4 border-slate-50 rounded-[60px] focus:border-indigo-200 focus:bg-indigo-50/20 outline-none transition-all placeholder:text-slate-100 font-serif"
                    placeholder="汉"
                    maxLength={2}
                    required
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-12 bg-indigo-600 text-white py-6 rounded-3xl font-black text-2xl shadow-2xl shadow-indigo-200 disabled:bg-slate-200 transition-all active:scale-95"
                  >
                    {loading ? '同步资料中...' : '保存并立即开启复习'}
                  </button>
                </form>
              ) : (
                <div className="space-y-8">
                  <div>
                    <label className="block text-slate-500 font-bold mb-3 px-4">粘贴历史已学汉字</label>
                    <textarea 
                      className="w-full h-48 text-2xl p-8 border-4 border-slate-50 rounded-[40px] focus:border-indigo-200 focus:bg-indigo-50/20 outline-none transition-all resize-none font-serif leading-relaxed"
                      placeholder="例如：大小多少、水火木金土..."
                      onChange={(e) => (window as any)._bulkText = e.target.value}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-slate-500 font-bold mb-4 px-4">
                      设置初始掌握等级：
                      <span className="ml-2 text-indigo-600">
                        {bulkStage === 0 ? "从零开始" : bulkStage < 4 ? "部分掌握" : "已经很熟"}
                      </span>
                    </label>
                    <div className="grid grid-cols-7 gap-2 bg-slate-50 p-2 rounded-2xl overflow-x-auto">
                      {SRS_INTERVALS.map((days, i) => (
                        <button
                          key={i}
                          onClick={() => setBulkStage(i)}
                          className={`min-w-[50px] py-3 rounded-xl font-bold transition-all ${bulkStage === i ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-200 text-slate-400'}`}
                        >
                          级{i+1}
                          <div className="text-[10px] opacity-70">+{days}天</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    disabled={loading}
                    onClick={() => handleBulkAdd((window as any)._bulkText || '')}
                    className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-2xl shadow-2xl shadow-indigo-200 disabled:bg-slate-200 active:scale-95 transition-all"
                  >
                    {loading ? '智能解析并生成计划...' : '立即同步批量记录'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'LEARN' && (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            {dueCards.length > 0 ? (
              <div className="max-w-3xl w-full">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-6 py-2 bg-rose-50 text-rose-500 rounded-full text-lg font-bold mb-10 border border-rose-100">
                    待复习: {dueCards.length} 字
                  </div>
                  
                  <div className="bg-slate-50 aspect-square max-w-lg mx-auto flex items-center justify-center rounded-[80px] border-4 border-white shadow-2xl relative group transition-all">
                    <span className="text-[200px] font-serif text-slate-800 leading-none select-none">{dueCards[0].character}</span>
                    
                    <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center rounded-[80px] px-12 text-center">
                      <p className="text-5xl text-indigo-600 font-black mb-6 tracking-widest">{dueCards[0].pinyin}</p>
                      <div className="h-1 w-20 bg-indigo-100 mb-6 rounded-full"></div>
                      <p className="text-slate-600 text-2xl font-medium leading-relaxed">{dueCards[0].meaning}</p>
                      <div className="mt-8 flex gap-2">
                        {SRS_INTERVALS.map((_, i) => (
                          <div key={i} className={`h-1.5 w-8 rounded-full ${i <= dueCards[0].srsStage ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8 mt-16 max-w-lg mx-auto">
                  <button 
                    onClick={() => handleReview(dueCards[0].id, false)}
                    className="py-8 bg-slate-100 text-slate-500 rounded-[40px] font-bold text-2xl hover:bg-rose-100 hover:text-rose-600 transition-all"
                  >
                    记不清
                  </button>
                  <button 
                    onClick={() => handleReview(dueCards[0].id, true)}
                    className="py-8 bg-indigo-600 text-white rounded-[40px] font-black text-2xl shadow-xl hover:bg-indigo-700 transition-all"
                  >
                    认识
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-slate-50 w-full rounded-[60px] border-2 border-dashed border-slate-200">
                <span className="text-9xl mb-10 block">🌈</span>
                <h3 className="text-5xl font-black text-slate-800">学习计划完成！</h3>
                <button 
                  onClick={() => setView('HOME')} 
                  className="mt-12 bg-slate-800 text-white px-16 py-5 rounded-full font-bold text-xl shadow-xl hover:bg-slate-900 transition-all"
                >
                  返回主页
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'LIST' && (
          <div className="py-6">
            <header className="flex justify-between items-center mb-12 bg-slate-50 p-8 rounded-3xl">
              <div>
                <h2 className="text-3xl font-black text-slate-800">已录入字库</h2>
                <p className="text-slate-400 font-medium mt-1">陪伴孩子成长的点滴记录</p>
              </div>
              <div className="bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-4xl font-black text-indigo-600">{activeProfile.cards?.length || 0}</span>
                <span className="ml-2 text-slate-400 font-bold">总计汉字</span>
              </div>
            </header>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {activeProfile.cards?.map(c => {
                const isMastered = c.srsStage >= SRS_INTERVALS.length - 1;
                return (
                  <div key={c.id} className="bg-white p-8 rounded-[32px] text-center border-2 border-slate-50 relative overflow-hidden group hover:border-indigo-100 hover:shadow-lg transition-all">
                    <div className="text-5xl mb-4 font-serif text-slate-800">{c.character}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase">
                      阶段 {c.srsStage + 1} / {SRS_INTERVALS.length}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-50">
                      <div 
                        className={`h-full transition-all duration-500 ${isMastered ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${((c.srsStage + 1) / SRS_INTERVALS.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
