


import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Shield, Check, X, Key, Bug, Trash2, Megaphone, Wand2, Globe, Loader2, Image as ImageIcon, Wrench, AlertTriangle, Clock, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import { enhanceNewsContent, enhanceUpdateContent, generateCinemaNews } from '../services/geminiService';
import { searchMoviesTMDB, searchPersonTMDB, getImageUrl } from '../services/tmdbService';

// Sub-component for individual news row with internal confirmation state
const NewsItemRow: React.FC<{ item: any, onDelete: (id: string) => Promise<void> }> = ({ item, onDelete }) => {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirming) {
            setDeleting(true);
            await onDelete(item.id);
            setDeleting(false); // Component will unmount, but just in case
        } else {
            setConfirming(true);
            // Reset confirmation timeout after 3 seconds
            setTimeout(() => setConfirming(false), 3000);
        }
    };

    return (
        <div className="bg-black/30 p-3 rounded-lg border border-gray-700 flex justify-between items-start group hover:border-gray-500 transition-colors animate-fade-in">
            <div className="mr-3 overflow-hidden">
                <p className="font-bold text-white text-sm truncate">{item.title}</p>
                <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleDateString()} • {item.type}</p>
            </div>
            <button 
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                }}
                disabled={deleting}
                className={`p-2 rounded-full transition-all flex items-center justify-center gap-1 flex-shrink-0 ${
                    confirming 
                    ? 'bg-red-600 text-white w-auto px-3 hover:bg-red-700 shadow-lg shadow-red-900/50' 
                    : 'text-gray-500 hover:text-red-500 hover:bg-red-900/20'
                }`}
                title={confirming ? "Confirmar Borrado" : "Borrar Noticia"}
            >
                {deleting ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : confirming ? (
                    <>
                        <Trash2 size={14} />
                        <span className="text-xs font-bold whitespace-nowrap">¿Seguro?</span>
                    </>
                ) : (
                    <Trash2 size={18} />
                )}
            </button>
        </div>
    );
};

const AdminPanel: React.FC = () => {
  const { allUsers, approveUser, rejectUser, tmdbToken, setTmdbToken, feedbackList, resolveFeedback, deleteFeedback, publishNews, deleteNews, news, resetGamification, resetAutomation, automationStatus, auditQuality } = useData();
  const [activeTab, setActiveTab] = useState<'users' | 'feedback' | 'news' | 'config'>('users');
  
  // Token State
  const [newToken, setNewToken] = useState(tmdbToken);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // News State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImageUrl, setNewsImageUrl] = useState('');
  const [newsSent, setNewsSent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);

  // Manual Update State (Feedback Tab)
  const [updateDraft, setUpdateDraft] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');

  // World News State
  const [generatedNews, setGeneratedNews] = useState<{ title: string, content: string, visualPrompt: string, searchQuery: string }[]>([]);

  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const pendingFeedback = feedbackList.filter(f => f.status === 'pending');

  // Helper
  const formatTime = (timestamp: number) => {
      if (!timestamp) return '--:--';
      const date = new Date(timestamp);
      const today = new Date().toLocaleDateString();
      const dateStr = date.toLocaleDateString();
      
      if (dateStr === today) {
          return `Hoy ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      }
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }

  const handleSaveToken = async () => {
      if (!newToken.trim()) {
        setSaveMessage({ type: 'error', text: 'El token no puede estar vacío.' });
        return;
      }
      try {
        await setTmdbToken(newToken);
        setSaveMessage({ type: 'success', text: '¡Clave guardada!' });
      } catch (e) {
        setSaveMessage({ type: 'error', text: 'Error al guardar.' });
      }
      setTimeout(() => setSaveMessage(null), 3000);
  };

  const handlePublishNews = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newsTitle || !newsContent) return;
      await publishNews(newsTitle, newsContent, 'general', newsImageUrl);
      setNewsTitle('');
      setNewsContent('');
      setNewsImageUrl('');
      setNewsSent(true);
      setTimeout(() => setNewsSent(false), 3000);
  };

  const handleEnhanceNews = async () => {
      if (!newsContent) return;
      setAiLoading(true);
      try {
          const result = await enhanceNewsContent(newsContent);
          if (result) {
              setNewsTitle(result.title);
              setNewsContent(result.content);
              const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(result.visualPrompt)}?nologo=true&width=800&height=400`;
              setNewsImageUrl(img);
          }
      } catch(e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  // --- UPDATE HANDLING ---

  const handleEnhanceUpdate = async () => {
      if (!updateDraft) return;
      setAiLoading(true);
      try {
          const result = await enhanceUpdateContent(updateDraft);
          if (result) {
              setUpdateTitle(result.title);
              setUpdateContent(result.content);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const handlePublishManualUpdate = async () => {
      if (!updateTitle || !updateContent) return;
      await publishNews(updateTitle, updateContent, 'update');
      setUpdateDraft('');
      setUpdateTitle('');
      setUpdateContent('');
      alert("¡Mejora publicada en el Registro de Cambios!");
  };

  const handleGenerateWorldNews = async () => {
      setAiLoading(true);
      try {
          // Extract titles of existing news to avoid duplicates
          const existingTitles = news.map(n => n.title);
          
          const generated = await generateCinemaNews(existingTitles);
          setGeneratedNews(generated);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const handleSelectGeneratedNews = async (newsItem: { title: string, content: string, visualPrompt: string, searchQuery: string }) => {
      setNewsTitle(newsItem.title);
      setNewsContent(newsItem.content);
      
      // Try to find a real image from TMDB first
      let realImage = '';
      if (newsItem.searchQuery && tmdbToken) {
          try {
              // Try movie first
              const movies = await searchMoviesTMDB(newsItem.searchQuery, tmdbToken);
              // Prioritize images with Backdrops
              const bestMovie = movies.find(m => m.backdrop_path) || movies.find(m => m.poster_path);

              if (bestMovie) {
                  realImage = getImageUrl(bestMovie.backdrop_path || bestMovie.poster_path, 'original');
              } else {
                  // Try person
                  const people = await searchPersonTMDB(newsItem.searchQuery, tmdbToken);
                  const bestPerson = people.find(p => p.profile_path);
                  if (bestPerson) {
                      realImage = getImageUrl(bestPerson.profile_path, 'original');
                  }
              }
          } catch (e) {
              console.error("Image search failed", e);
          }
      }

      if (realImage) {
          setNewsImageUrl(realImage);
      } else {
          // Fallback to AI Image
          const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(newsItem.visualPrompt)}?nologo=true&width=800&height=400`;
          setNewsImageUrl(img);
      }
      setGeneratedNews([]); // Clear selection
  };
  
  const handleResetGamification = async () => {
      const confirm = window.confirm("¡PELIGRO! Esto borrará el XP, Nivel, Misiones y Créditos de TODOS los usuarios. ¿Estás seguro?");
      if (confirm) {
          await resetGamification();
      }
  }

  const handleResetAutomation = async () => {
      const confirm = window.confirm("¿Resetear el sistema de Noticias Automáticas? Se desbloqueará y se intentará publicar de nuevo en la próxima carga.");
      if (confirm) {
          await resetAutomation();
          alert("Sistema reseteado. Recarga la página para forzar el trigger.");
      }
  }

  const handleAudit = async () => {
      setIsAuditing(true);
      setAuditResult(null);
      try {
          const count = await auditQuality();
          setAuditResult(`Auditoría completada. Se han enviado ${count} avisos de corrección a usuarios.`);
      } catch(e) {
          setAuditResult("Error durante la auditoría.");
      } finally {
          setIsAuditing(false);
      }
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-cine-red" size={32} />
        <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'users' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Socios</button>
          <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'feedback' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Feedback ({pendingFeedback.length})</button>
          <button onClick={() => setActiveTab('news')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'news' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Redacción (IA)</button>
          <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'config' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Configuración</button>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
          <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white">Solicitudes Pendientes ({pendingUsers.length})</h3>
            </div>
            {pendingUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No hay solicitudes pendientes.</div>
            ) : (
                <div>
                    {pendingUsers.map(user => (
                        <div key={user.id} className="p-4 border-b border-gray-800 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <img src={user.avatarUrl} className="w-12 h-12 rounded-full" />
                                <div><p className="font-bold text-white">{user.name}</p><p className="text-gray-400 text-sm">{user.email}</p></div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => approveUser(user.id)} className="px-3 py-1 bg-green-600 rounded text-white"><Check/></button>
                                <button onClick={() => rejectUser(user.id)} className="px-3 py-1 bg-red-600 rounded text-white"><X/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
      )}

      {/* FEEDBACK TAB */}
      {activeTab === 'feedback' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* LEFT: USER FEEDBACK */}
              <div className="space-y-4">
                  <h3 className="font-bold text-white mb-2 text-lg">Reportes de Usuarios</h3>
                  {pendingFeedback.length === 0 ? <p className="text-gray-500 bg-cine-gray p-6 rounded-xl border border-gray-800">No hay feedback pendiente.</p> : pendingFeedback.map(fb => (
                      <div key={fb.id} className="bg-cine-gray p-4 rounded-xl border border-gray-800">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                  {fb.type === 'bug' ? <Bug className="text-red-500" size={18}/> : <Shield className="text-yellow-500" size={18}/>}
                                  <span className="font-bold text-white uppercase text-sm">{fb.type}</span>
                                  <span className="text-gray-500 text-xs">• {fb.userName}</span>
                              </div>
                              <span className="text-gray-600 text-xs">{new Date(fb.timestamp).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-300 mb-4 bg-black/30 p-3 rounded">{fb.text}</p>
                          <div className="flex justify-end gap-3">
                              <button onClick={() => deleteFeedback(fb.id)} className="text-red-400 hover:text-white"><Trash2 size={18}/></button>
                              <button onClick={() => resolveFeedback(fb.id)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
                                  <Check size={16}/> Marcar Solucionado y Publicar
                              </button>
                          </div>
                      </div>
                  ))}
              </div>

              {/* RIGHT: MANUAL UPDATE PUBLISHER */}
              <div className="bg-cine-gray p-6 rounded-xl border border-gray-800 h-fit">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Wrench className="text-blue-400"/> Registro de Cambios Manual</h3>
                  <p className="text-gray-400 text-sm mb-4">¿Has arreglado o mejorado algo por tu cuenta? Publícalo aquí.</p>
                  
                  <textarea 
                      value={updateDraft}
                      onChange={(e) => setUpdateDraft(e.target.value)}
                      placeholder="Ej: He arreglado el fallo del login y ahora va más rápido..."
                      className="w-full h-24 bg-black/50 border border-gray-600 rounded p-3 text-white mb-3 focus:border-cine-gold outline-none text-sm"
                  />
                  
                  <button 
                      onClick={handleEnhanceUpdate}
                      disabled={aiLoading || !updateDraft}
                      className="w-full mb-6 bg-blue-900/50 hover:bg-blue-900 text-blue-200 p-2 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-50"
                  >
                       {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>} Redactar mejora con IA
                  </button>

                  {(updateTitle || updateContent) && (
                      <div className="space-y-3 animate-fade-in border-t border-gray-700 pt-4">
                          <input 
                              type="text" 
                              value={updateTitle}
                              onChange={(e) => setUpdateTitle(e.target.value)}
                              className="w-full bg-black/50 border border-gray-600 rounded p-2 text-white font-bold"
                              placeholder="Título final..."
                          />
                          <textarea 
                              value={updateContent}
                              onChange={(e) => setUpdateContent(e.target.value)}
                              className="w-full bg-black/50 border border-gray-600 rounded p-2 text-white text-sm"
                              placeholder="Contenido final..."
                          />
                          <button 
                              onClick={handlePublishManualUpdate}
                              className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-500 transition-colors"
                          >
                              Publicar Mejora
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* NEWS EDITOR TAB */}
      {activeTab === 'news' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* EDITOR COLUMN */}
              <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Megaphone className="text-cine-gold"/> Redactor Jefe</h3>
                  
                  <div className="flex gap-2 mb-4">
                      <button 
                        onClick={handleEnhanceNews}
                        disabled={aiLoading || !newsContent}
                        className="flex-1 bg-purple-900/50 hover:bg-purple-900 text-purple-200 p-3 rounded-lg border border-purple-500/30 flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-50"
                      >
                          {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
                          Mejorar con IA + Imagen
                      </button>
                      <button 
                        onClick={handleGenerateWorldNews}
                        disabled={aiLoading}
                        className="flex-1 bg-blue-900/50 hover:bg-blue-900 text-blue-200 p-3 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 text-sm font-bold transition-colors disabled:opacity-50"
                      >
                          {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Globe size={16}/>}
                          Buscar Actualidad Cine
                      </button>
                  </div>

                  <form onSubmit={handlePublishNews} className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Título del titular..." 
                        className="w-full bg-black/50 border border-gray-600 p-3 rounded text-white focus:border-cine-gold outline-none"
                        value={newsTitle}
                        onChange={e => setNewsTitle(e.target.value)}
                      />
                      <textarea 
                        placeholder="Escribe un borrador rápido y pulsa 'Mejorar con IA'..." 
                        className="w-full h-48 bg-black/50 border border-gray-600 p-3 rounded text-white focus:border-cine-gold outline-none"
                        value={newsContent}
                        onChange={e => setNewsContent(e.target.value)}
                      />
                      
                      {newsImageUrl && (
                          <div className="relative group">
                              <img src={newsImageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg border border-gray-600" />
                              <button 
                                type="button" 
                                onClick={() => setNewsImageUrl('')}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <X size={14} />
                              </button>
                              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-gray-300 flex items-center gap-1">
                                  <ImageIcon size={12}/> {newsImageUrl.includes('tmdb') ? 'Imagen TMDB' : 'Imagen IA'}
                              </div>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-cine-gold text-black px-6 py-3 rounded font-bold hover:bg-white transition-colors">
                          Publicar Noticia
                      </button>
                      {newsSent && <p className="text-green-500 text-center font-bold">¡Publicado en portada!</p>}
                  </form>

                  {/* MANAGE PUBLISHED NEWS */}
                  <div className="mt-8 pt-8 border-t border-gray-800">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="text-cine-gold"/> Gestionar Noticias Publicadas</h3>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {news.map(item => (
                              <NewsItemRow key={item.id} item={item} onDelete={deleteNews} />
                          ))}
                          {news.length === 0 && <p className="text-gray-500 text-sm italic">No hay noticias publicadas.</p>}
                      </div>
                  </div>
              </div>

              {/* GENERATED CONTENT & AUTOMATION STATUS COLUMN */}
              <div className="space-y-6">
                  {/* MONITORING STATUS BOX */}
                  <div className="bg-black/60 border border-gray-700 p-6 rounded-xl relative overflow-hidden">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="text-white font-bold flex items-center gap-2">
                              {automationStatus.isGenerating ? (
                                  <Loader2 size={18} className="text-cine-gold animate-spin"/>
                              ) : (
                                  <RefreshCw size={18} className="text-cine-gold"/> 
                              )}
                              Monitor de Automatización
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${automationStatus.dailyCount >= 10 ? 'bg-red-900 text-red-200' : automationStatus.isGenerating ? 'bg-yellow-600 text-black animate-pulse' : 'bg-green-900 text-green-200'}`}>
                              {automationStatus.isGenerating ? 'GENERANDO...' : automationStatus.dailyCount >= 10 ? 'Cupo Completo' : 'Sistema Activo'}
                          </span>
                      </div>
                      
                      <div className="space-y-4 text-sm">
                          <div className="flex justify-between items-center text-gray-400">
                              <span>Noticias hoy:</span>
                              <span className="text-white font-bold">{automationStatus.dailyCount} / 10</span>
                          </div>
                          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                              <div className="h-full bg-cine-gold transition-all duration-500" style={{ width: `${(automationStatus.dailyCount / 10) * 100}%` }}></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-2">
                              <div className="bg-black/30 p-2 rounded border border-gray-800">
                                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Última Publicación</p>
                                  <p className="text-white font-mono flex items-center gap-1">
                                      <Clock size={12} className="text-gray-400"/>
                                      {formatTime(automationStatus.lastRun)}
                                  </p>
                              </div>
                              <div className="bg-black/30 p-2 rounded border border-gray-800">
                                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Próximo Trigger</p>
                                  <p className="text-cine-gold font-mono flex items-center gap-1">
                                      <Clock size={12}/>
                                      {automationStatus.dailyCount >= 10 ? 'Mañana' : 
                                       automationStatus.isGenerating ? 'En progreso...' :
                                       (automationStatus.nextRun < Date.now() ? 'Ahora (al entrar usuario)' : formatTime(automationStatus.nextRun))}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Manual Generation Results */}
                  {generatedNews.length > 0 && (
                      <div className="space-y-4 animate-fade-in">
                          <h4 className="text-gray-400 text-sm font-bold uppercase">Resultados Manuales:</h4>
                          {generatedNews.map((news, idx) => (
                              <div key={idx} className="bg-black/40 p-4 rounded-xl border border-gray-700 hover:border-cine-gold transition-colors cursor-pointer group" onClick={() => handleSelectGeneratedNews(news)}>
                                  <h5 className="font-bold text-white mb-2 group-hover:text-cine-gold">{news.title}</h5>
                                  <p className="text-gray-400 text-sm line-clamp-3">{news.content}</p>
                                  <button className="mt-3 text-xs bg-cine-gold/20 text-cine-gold px-3 py-1 rounded border border-cine-gold/30 font-bold w-full">Usar esta noticia</button>
                              </div>
                          ))}
                      </div>
                  )}
                  
                  {generatedNews.length === 0 && !aiLoading && (
                      <div className="bg-black/20 p-8 rounded-xl border border-dashed border-gray-800 text-center text-gray-500">
                          <Globe className="mx-auto mb-3 opacity-20" size={48} />
                          <p>Pulsa "Buscar Actualidad Cine" para generar noticias manuales.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && (
          <div className="space-y-6">
              <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Key size={20} className="text-cine-gold" /> Configuración TMDB</h3>
                  <div className="flex gap-4">
                    <input type="text" value={newToken} onChange={(e) => setNewToken(e.target.value)} className="flex-grow bg-black/50 border border-gray-600 rounded p-3 text-white" />
                    <button onClick={handleSaveToken} className="bg-cine-gold text-black font-bold px-6 rounded">Guardar</button>
                  </div>
                  {saveMessage && <p className={`mt-2 ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{saveMessage.text}</p>}
              </div>

              {/* QUALITY CONTROL */}
              <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><CheckCircle size={20} className="text-green-500" /> Control de Calidad</h3>
                  <p className="text-gray-400 text-sm mb-4">
                      Revisar reseñas antiguas que no cumplen los nuevos estándares (mínimo 50 palabras y 2 párrafos) y enviar avisos automáticos a los autores.
                  </p>
                  <button 
                    onClick={handleAudit}
                    disabled={isAuditing}
                    className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                      {isAuditing ? <Loader2 className="animate-spin" size={18}/> : <Shield size={18}/>}
                      {isAuditing ? 'Auditando...' : 'Auditar Reseñas Cortas'}
                  </button>
                  {auditResult && (
                      <p className="mt-3 text-green-400 font-bold animate-fade-in">{auditResult}</p>
                  )}
              </div>

              {/* DANGER ZONE */}
              <div className="bg-red-900/10 p-6 rounded-xl border border-red-900/50">
                  <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><AlertTriangle size={20}/> Zona de Peligro</h3>
                  
                  <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 bg-black/30 p-4 rounded-lg border border-red-800/30">
                          <h4 className="font-bold text-red-400 mb-2">Resetear Gamificación</h4>
                          <p className="text-xs text-gray-400 mb-4">Pondrá a TODOS los usuarios en Nivel 1, XP 0. Irreversible.</p>
                          <button 
                            onClick={handleResetGamification}
                            className="bg-red-900 text-white font-bold py-2 px-4 rounded hover:bg-red-800 transition-colors w-full text-sm"
                          >
                              ⚠️ EJECUTAR RESET TOTAL
                          </button>
                      </div>

                      <div className="flex-1 bg-black/30 p-4 rounded-lg border border-red-800/30">
                          <h4 className="font-bold text-red-400 mb-2">Resetear Automatización Noticias</h4>
                          <p className="text-xs text-gray-400 mb-4">Desbloquea el sistema si se ha quedado atascado.</p>
                          <button 
                            onClick={handleResetAutomation}
                            className="bg-red-900 text-white font-bold py-2 px-4 rounded hover:bg-red-800 transition-colors w-full text-sm"
                          >
                              🔄 DESBLOQUEAR SISTEMA
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminPanel;