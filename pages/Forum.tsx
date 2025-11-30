import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { MessageSquare, ThumbsUp, MessageCircle, Send } from 'lucide-react';

const Forum: React.FC = () => {
  const { forumPosts, addForumPost, user } = useData();
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim() && newContent.trim()) {
      addForumPost(newTitle, newContent);
      setNewTitle('');
      setNewContent('');
      setIsPosting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-cine-gold" />
            Cine Forum
        </h2>
        <button 
            onClick={() => setIsPosting(!isPosting)}
            className="bg-cine-gold text-cine-dark px-4 py-2 rounded-lg font-bold hover:bg-white transition-colors"
        >
            {isPosting ? 'Cancelar' : 'Nuevo Tema'}
        </button>
      </div>

      {isPosting && (
        <form onSubmit={handleSubmit} className="bg-cine-gray p-6 rounded-xl border border-gray-700 mb-8 animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-4">Crear nuevo debate</h3>
            <input 
                type="text" 
                placeholder="Título del debate..." 
                className="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-white mb-3 focus:outline-none focus:border-cine-gold"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea 
                placeholder="¿Qué opinas sobre...?" 
                className="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-white mb-4 h-32 focus:outline-none focus:border-cine-gold"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
            />
            <button type="submit" className="flex items-center gap-2 bg-cine-red text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
                <Send size={18} /> Publicar
            </button>
        </form>
      )}

      <div className="space-y-4">
        {forumPosts.map(post => (
          <div key={post.id} className="bg-cine-gray p-6 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors">
            <div className="flex items-start gap-4">
                <img src={post.userAvatar} alt={post.userName} className="w-12 h-12 rounded-full border border-gray-700" />
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-white hover:text-cine-gold cursor-pointer">{post.title}</h3>
                            <p className="text-xs text-gray-500 mb-2">
                                Por <span className="text-gray-300">{post.userName}</span> • {new Date(post.timestamp).toLocaleDateString()}
                            </p>
                        </div>
                        {post.movieTitle && (
                            <span className="text-xs bg-cine-gold/20 text-cine-gold px-2 py-1 rounded border border-cine-gold/30">
                                {post.movieTitle}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-300 mb-4">{post.content}</p>
                    
                    <div className="flex gap-6 border-t border-gray-800 pt-3">
                        <button className="flex items-center gap-2 text-gray-500 hover:text-cine-gold text-sm">
                            <ThumbsUp size={16} /> {post.likes} Me gusta
                        </button>
                        <button className="flex items-center gap-2 text-gray-500 hover:text-white text-sm">
                            <MessageCircle size={16} /> {post.replies} Respuestas
                        </button>
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Forum;