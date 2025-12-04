import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Shield, Check, X, Key, Bug, Trash2, Megaphone, Wand2, Globe, Loader2, Image as ImageIcon, Wrench, AlertTriangle, Clock, RefreshCw, FileText, CheckCircle, Search, Mail, ShieldAlert, UserX, UserCheck, Ban, Calendar, Trophy, Ticket, Star, Medal } from 'lucide-react';
import { enhanceNewsContent, enhanceUpdateContent, generateCinemaNews } from '../services/geminiService';
import { searchMoviesTMDB, searchPersonTMDB, getImageUrl } from '../services/tmdbService';
import RankBadge from '../components/RankBadge';
import { MISSIONS, XP_TABLE } from '../constants';
import { User } from '../types';

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
  const { allUsers, approveUser, rejectUser, deleteUserAccount, toggleUserAdmin, sendSystemMessage, tmdbToken, setTmdbToken, feedbackList, resolveFeedback, deleteFeedback, publishNews, deleteNews, news, resetGamification, resetAutomation, automationStatus, auditQuality } = useData();
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

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [msgModal, setMsgModal] = useState<{ userId: string, name: string } | null>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  
  // Stats Modal State
  const [statsUser, setStatsUser] = useState<User | null>(null);
  
  // Ban Modal State
  const [banModal, setBanModal] = useState<{ userId: string, name: string } | null>(null);
  const [banDuration, setBanDuration] = useState<string>('permanent'); // '1h', '24h', '3d', '7d', '30d', 'permanent'

  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const pendingFeedback = feedbackList.filter(f => f.status === 'pending');

  const filteredUsers = useMemo(() => {
      return allUsers.filter(u => 
          u.status !== 'pending' && 
          (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
      );
  }, [allUsers, userSearch]);

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

  const handleSendMessage = async () => {
      if (!msgModal || !msgTitle || !msgBody) return;
      await sendSystemMessage(msgModal.userId, msgTitle, msgBody, 'info');
      setMsgModal(null);
      setMsgTitle('');
      setMsgBody('');
      alert("Mensaje enviado correctamente.");
  }

  const handleDeleteUser = async (userId: string) => {
      const confirm = window.confirm("¿ESTÁS SEGURO? Esta acción borrará permanentemente la cuenta del usuario y sus datos. No se puede deshacer.");
      if (confirm) {
          await deleteUserAccount(userId);
      }
  }

  const handleConfirmBan = async () => {
      if (!banModal) return;
      
      let ms = 0;
      switch(banDuration) {
          case '1h': ms = 60 * 60 * 1000; break;
          case '24h': ms = 24 * 60 * 60 * 1000; break;
          case '3d': ms = 3 * 24 * 60 * 60 * 1000; break;
          case '7d': ms = 7 * 24 * 60 * 60 * 1000; break;
          case '30d': ms = 30 * 24 * 60 * 60 * 1000; break;
          case 'permanent': ms = 0; break;
      }

      await rejectUser(banModal.userId, ms);
      setBanModal(null);
  }

  // --- XP Calculation Helper for Modal ---
  const getStatsProgress = (u: User) => {
      const currentLevel = u.level || 1;
      const xp = u.xp || 0;
      let prevThreshold = 0;
      let nextThreshold = XP_TABLE[0];
      if (currentLevel > 1) {
          prevThreshold = XP_TABLE[currentLevel - 2];
          nextThreshold = XP_TABLE[currentLevel - 1] || (prevThreshold * 1.5);
      }
      const percent = Math.min(100, (Math.max(0, xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100);
      return { percent, nextThreshold };
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-cine-red" size={32} />
        <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
      </div>

      {/* Message Modal */}
      {msgModal && (
          <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
              <div className="bg-cine-gray p-6 rounded-xl border border-cine-gold w-full max-w-md">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Mail size={20}/> Mensaje para {msgModal.name}</h3>
                  <input type="text" placeholder="Asunto" className="w-full bg-black/50 border border-gray-600 rounded p-2 text-white mb-2" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} />
                  <textarea placeholder="Escribe tu mensaje..." className="w-full h-32 bg-black/50 border border-gray-600 rounded p-2 text-white mb-4" value={msgBody} onChange={e => setMsgBody(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setMsgModal(null)} className="px-4 py-2 text-gray-400">Cancelar</button>
                      <button onClick={handleSendMessage} className="bg-cine-gold text-black font-bold px-4 py-2 rounded">Enviar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Ban Confirmation Modal */}
      {banModal && (
          <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-cine-gray p-6 rounded-xl border border-red-500 w-full max-w-sm shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                  <div className="flex items-center gap-3 text-red-500 mb-4">
                      <Ban size={32} />
                      <h3 className="text-xl font-bold">Banear a {banModal.name}</h3>
                  </div>
                  
                  <p className="text-gray-400 mb-4 text-sm">
                      Selecciona la duración del castigo. El usuario no podrá entrar en la app hasta que pase este tiempo.
                  </p>

                  <div className="space-y-2 mb-6">
                      <select 
                        value={banDuration} 
                        onChange={(e) => setBanDuration(e.target.value)}
                        className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-red-500 outline-none"
                      >
                          <option value="1h">1 Hora (Advertencia)</option>
                          <option value="24h">24 Horas (Leve)</option>
                          <option value="3d">3 Días (Moderado)</option>
                          <option value="7d">1 Semana (Grave)</option>
                          <option value="30d">1 Mes (Muy Grave)</option>
                          <option value="permanent">PERMANENTE (Expulsión)</option>
                      </select>
                  </div>

                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setBanModal(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
                      <button onClick={handleConfirmBan} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded shadow-lg transition-colors">
                          Aplicar Sanción
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Career Stats Modal */}
      {statsUser && (
          <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-cine-gray w-full max-w-2xl rounded-2xl border border-cine-gold shadow-[0_0_50px_rgba(212,175,55,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="relative p-6 border-b border-gray-700 bg-black/40">
                      <button onClick={() => setStatsUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24}/></button>
                      <div className="flex items-center gap-6">
                          <img src={statsUser.avatarUrl} alt={statsUser.name} className="w-20 h-20 rounded-full border-2 border-cine-gold shadow-lg" />
                          <div>
                              <h3 className="text-2xl font-bold text-white mb-2">{statsUser.name}</h3>
                              <RankBadge level={statsUser.level || 1} size="md"/>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-black/30 p-3 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500 uppercase font-bold">Nivel</p>
                              <p className="text-2xl font-black text-white">{statsUser.level || 1}</p>
                          </div>
                          <div className="bg-black/30 p-3 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500 uppercase font-bold">Experiencia</p>
                              <p className="text-2xl font-black text-cine-gold">{statsUser.xp || 0}</p>
                          </div>
                          <div className="bg-black/30 p-3 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500 uppercase font-bold">Créditos</p>
                              <p className="text-2xl font-black text-green-500">{statsUser.credits || 0}</p>
                          </div>
                          <div className="bg-black/30 p-3 rounded-lg border border-gray-700 text-center">
                              <p className="text-xs text-gray-500 uppercase font-bold">Misiones</p>
                              <p className="text-2xl font-black text-blue-400">{statsUser.completedMissions?.length || 0}</p>
                          </div>
                      </div>

                      {/* XP Progress Bar */}
                      <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Progreso Nivel {statsUser.level || 1}</span>
                              <span>Siguiente Nivel</span>
                          </div>
                          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                              <div 
                                  className="h-full bg-gradient-to-r from-cine-gold to-yellow-600"
                                  style={{ width: `${getStatsProgress(statsUser).percent}%` }}
                              ></div>
                          </div>
                      </div>

                      {/* Missions List */}
                      <div>
                          <h4 className="font-bold text-white mb-3 flex items-center gap-2 border-b border-gray-700 pb-2">
                              <Medal size={18} className="text-cine-gold"/> Historial de Misiones
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                              {[...MISSIONS].sort((a, b) => {
                                  const aCompleted = statsUser.completedMissions?.includes(a.id) ? 1 : 0;
                                  const bCompleted = statsUser.completedMissions?.includes(b.id) ? 1 : 0;
                                  return bCompleted - aCompleted; // Completed first
                              }).map(mission => {
                                  const isCompleted = statsUser.completedMissions?.includes(mission.id);
                                  const Icon = mission.icon;
                                  return (
                                      <div key={mission.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isCompleted ? 'bg-black/40 border-green-900/30' : 'bg-black/20 border-gray-800 opacity-60'}`}>
                                          <div className={`p-2 rounded-full ${isCompleted ? 'bg-green-900/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                                              {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                                          </div>
                                          <div className="flex-grow">
                                              <p className={`text-sm font-bold ${isCompleted ? 'text-white' : 'text-gray-400'}`}>{mission.title}</p>
                                              <p className="text-xs text-gray-500">{mission.description}</p>
                                          </div>
                                          {isCompleted && (
                                              <span className="text-[10px] bg-green-900/20 text-green-400 px-2 py-1 rounded font-bold border border-green-900/30">
                                                  +{mission.xpReward} XP
                                              </span>
                                          )}
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-700 bg-black/40 text-right">
                      <button onClick={() => setStatsUser(null)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded transition-colors">
                          Cerrar Expediente
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'users' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Socios</button>
          <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'feedback' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Feedback ({pendingFeedback.length})</button>
          <button onClick={() => setActiveTab('news')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'news' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Redacción (IA)</button>
          <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'config' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>Configuración</button>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
          <div className="space-y-8">
              {/* PENDING REQUESTS */}
              <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-800 bg-yellow-900/10">
                    <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2"><UserCheck size={24}/> Solicitudes Pendientes ({pendingUsers.length})</h3>
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
                                    <button onClick={() => approveUser(user.id)} className="px-3 py-1 bg-green-600 rounded text-white flex items-center gap-1"><Check size={16}/> Aprobar</button>
                                    <button onClick={() => rejectUser(user.id)} className="px-3 py-1 bg-red-600 rounded text-white flex items-center gap-1"><X size={16}/> Rechazar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              {/* USER MANAGEMENT */}
              <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><Shield size={24} className="text-blue-400"/> Gestión de Socios</h3>
                      <div className="relative w-full md:w-64">
                          <input 
                            type="text" 
                            placeholder="Buscar usuario..." 
                            className="w-full bg-black/50 border border-gray-700 rounded-full py-2 pl-10 pr-4 text-white focus:border-cine-gold outline-none"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                          />
                          <Search className="absolute left-3 top-2.5 text-gray-500" size={16}/>
                      </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-400">
                          <thead className="bg-black/40 text-xs uppercase font-bold text-gray-500">
                              <tr>
                                  <th className="px-6 py-3">Usuario</th>
                                  <th className="px-6 py-3">Rol / Nivel</th>
                                  <th className="px-6 py-3">Estado</th>
                                  <th className="px-6 py-3 text-right">Acciones</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                              {filteredUsers.map(u => {
                                  const isTemporaryBan = u.status === 'rejected' && !!u.banExpiresAt;
                                  return (
                                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                      <td className="px-6 py-4 flex items-center gap-3">
                                          <img src={u.avatarUrl} className="w-10 h-10 rounded-full border border-gray-700" />
                                          <div>
                                              <p className="font-bold text-white">{u.name}</p>
                                              <p className="text-xs">{u.email}</p>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex flex-col gap-1">
                                              <span className={`text-xs font-bold px-2 py-0.5 rounded w-fit ${u.isAdmin ? 'bg-purple-900 text-purple-200' : 'bg-gray-800 text-gray-300'}`}>
                                                  {u.isAdmin ? 'ADMIN' : 'SOCIO'}
                                              </span>
                                              <RankBadge level={u.level || 1} size="sm" showTitle={false}/>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          {u.status === 'active' ? (
                                              <span className="text-green-500 flex items-center gap-1 font-bold text-xs"><CheckCircle size={12}/> Activo</span>
                                          ) : u.status === 'rejected' ? (
                                              <div className="flex flex-col">
                                                  <span className="text-red-500 flex items-center gap-1 font-bold text-xs"><Ban size={12}/> Baneado</span>
                                                  {isTemporaryBan ? (
                                                      <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10}/> Hasta {new Date(u.banExpiresAt!).toLocaleDateString()}</span>
                                                  ) : (
                                                      <span className="text-[10px] text-gray-500">Permanente</span>
                                                  )}
                                              </div>
                                          ) : (
                                              <span className="text-yellow-500 text-xs">Pendiente</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                              <button 
                                                onClick={() => setStatsUser(u)}
                                                className="p-2 bg-yellow-900/20 text-yellow-500 hover:bg-yellow-900/50 rounded transition-colors" title="Ver Carrera y Misiones"
                                              >
                                                  <Trophy size={16}/>
                                              </button>

                                              <button 
                                                onClick={() => setMsgModal({ userId: u.id, name: u.name })}
                                                className="p-2 bg-blue-900/20 text-blue-400 hover:bg-blue-900/50 rounded transition-colors" title="Enviar Mensaje"
                                              >
                                                  <Mail size={16}/>
                                              </button>
                                              
                                              <button 
                                                onClick={() => toggleUserAdmin(u.id)}
                                                className={`p-2 rounded transition-colors ${u.isAdmin ? 'bg-purple-900 text-white' : 'bg-gray-800 text-gray-500 hover:text-purple-400'}`} title="Alternar Admin"
                                              >
                                                  <ShieldAlert size={16}/>
                                              </button>

                                              {u.status === 'rejected' ? (
                                                  <button 
                                                    onClick={() => approveUser(u.id)}
                                                    className="p-2 bg-green-900/20 text-green-400 hover:bg-green-900/50 rounded transition-colors" title="Desbanear (Activar)"
                                                  >
                                                      <CheckCircle size={16}/>
                                                  </button>
                                              ) : (
                                                  <button 
                                                    onClick={() => setBanModal({ userId: u.id, name: u.name })}
                                                    className="p-2 bg-orange-900/20 text-orange-400 hover:bg-orange-900/50 rounded transition-colors" title="Banear Usuario"
                                                  >
                                                      <Ban size={16}/>
                                                  </button>
                                              )}

                                              <button 
                                                onClick={() => handleDeleteUser(u.id)}
                                                className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/50 rounded transition-colors" title="Borrar Cuenta"
                                              >
                                                  <Trash2 size={16}/>
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                      {filteredUsers.length === 0 && <div className="p-8 text-center text-gray-500 italic">No se encontraron usuarios.</div>}
                  </div>
              </div>
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