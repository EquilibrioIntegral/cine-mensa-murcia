
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Shield, Check, X, Key, Bug, Trash2, Megaphone, Wand2, Globe, Loader2, Image as ImageIcon } from 'lucide-react';
import { enhanceNewsContent, generateCinemaNews } from '../services/geminiService';

const AdminPanel: React.FC = () => {
  const { allUsers, approveUser, rejectUser, tmdbToken, setTmdbToken, feedbackList, resolveFeedback, deleteFeedback, publishNews } = useData();
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

  // World News State
  const [generatedNews, setGeneratedNews] = useState<{ title: string, content: string, visualPrompt: string }[]>([]);

  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const pendingFeedback = feedbackList.filter(f => f.status === 'pending');

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

  const handleGenerateWorldNews = async () => {
      setAiLoading(true);
      try {
          const news = await generateCinemaNews();
          setGeneratedNews(news);
      } catch (e) {
          console.error(e);
      } finally {
          setAiLoading(false);
      }
  };

  const handleSelectGeneratedNews = (newsItem: { title: string, content: string, visualPrompt: string }) => {
      setNewsTitle(newsItem.title);
      setNewsContent(newsItem.content);
      const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(newsItem.visualPrompt)}?nologo=true&width=800&height=400`;
      setNewsImageUrl(img);
      setGeneratedNews([]); // Clear selection
  };

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
          <div className="space-y-4">
              {pendingFeedback.length === 0 ? <p className="text-gray-500">No hay feedback pendiente.</p> : pendingFeedback.map(fb => (
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
                                  <ImageIcon size={12}/> Imagen IA
                              </div>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-cine-gold text-black px-6 py-3 rounded font-bold hover:bg-white transition-colors">
                          Publicar Noticia
                      </button>
                      {newsSent && <p className="text-green-500 text-center font-bold">¡Publicado en portada!</p>}
                  </form>
              </div>

              {/* GENERATED CONTENT COLUMN */}
              <div>
                  {generatedNews.length > 0 && (
                      <div className="space-y-4 animate-fade-in">
                          <h4 className="text-gray-400 text-sm font-bold uppercase">Noticias de Actualidad Encontradas:</h4>
                          {generatedNews.map((news, idx) => (
                              <div key={idx} className="bg-black/40 p-4 rounded-xl border border-gray-700 hover:border-cine-gold transition-colors cursor-pointer group" onClick={() => handleSelectGeneratedNews(news)}>
                                  <h5 className="font-bold text-white mb-2 group-hover:text-cine-gold">{news.title}</h5>
                                  <p className="text-gray-400 text-sm line-clamp-2">{news.content}</p>
                                  <button className="mt-3 text-xs bg-cine-gold/20 text-cine-gold px-3 py-1 rounded border border-cine-gold/30 font-bold w-full">Usar esta noticia</button>
                              </div>
                          ))}
                      </div>
                  )}
                  
                  {generatedNews.length === 0 && !aiLoading && (
                      <div className="bg-black/20 p-8 rounded-xl border border-dashed border-gray-800 text-center text-gray-500">
                          <Globe className="mx-auto mb-3 opacity-20" size={48} />
                          <p>Pulsa "Buscar Actualidad Cine" para generar noticias reales simuladas o escribe tu propio borrador.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && (
          <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Key size={20} className="text-cine-gold" /> Configuración TMDB</h3>
              <div className="flex gap-4">
                <input type="text" value={newToken} onChange={(e) => setNewToken(e.target.value)} className="flex-grow bg-black/50 border border-gray-600 rounded p-3 text-white" />
                <button onClick={handleSaveToken} className="bg-cine-gold text-black font-bold px-6 rounded">Guardar</button>
              </div>
              {saveMessage && <p className={`mt-2 ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{saveMessage.text}</p>}
          </div>
      )}
    </div>
  );
};

export default AdminPanel;
