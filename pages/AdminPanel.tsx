
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Shield, Check, X, Key } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const { allUsers, approveUser, rejectUser, tmdbToken, setTmdbToken } = useData();
  const [newToken, setNewToken] = useState(tmdbToken);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const pendingUsers = allUsers.filter(u => u.status === 'pending');

  const handleSaveToken = async () => {
      if (!newToken.trim()) {
        setSaveMessage({ type: 'error', text: 'El token no puede estar vacío.' });
        return;
      }

      try {
        await setTmdbToken(newToken);
        setSaveMessage({ type: 'success', text: '¡Clave guardada en la nube! Todos los usuarios tienen acceso ahora.' });
      } catch (e) {
        setSaveMessage({ type: 'error', text: 'Error al guardar en Firebase.' });
      }
      
      setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="text-cine-red" size={32} />
        <h2 className="text-3xl font-bold text-white">Panel de Administración</h2>
      </div>

      {/* TMDB Configuration */}
      <div className="bg-cine-gray p-6 rounded-xl border border-gray-800 mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key size={20} className="text-cine-gold" /> Configuración TMDB Global
          </h3>
          <p className="text-sm text-gray-400 mb-4">
              La clave que pongas aquí se guardará en la base de datos segura y la usarán todos los socios automáticamente.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
                <input 
                    type="text" 
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="Pega aquí tu API Key o Token..."
                    className="flex-grow bg-black/50 border border-gray-600 rounded p-3 text-white focus:border-cine-gold outline-none font-mono text-sm"
                />
                <button 
                    onClick={handleSaveToken}
                    className="bg-cine-gold text-black font-bold px-6 rounded hover:bg-white transition-colors"
                >
                    Guardar
                </button>
            </div>
            {saveMessage && (
                <div className={`mt-2 text-sm font-medium ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {saveMessage.text}
                </div>
            )}
          </div>
      </div>

      {/* User Approvals */}
      <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-xl font-bold text-white">Solicitudes Pendientes ({pendingUsers.length})</h3>
        </div>
        
        {pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                No hay solicitudes pendientes.
            </div>
        ) : (
            <div>
                {pendingUsers.map(user => (
                    <div key={user.id} className="p-4 border-b border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full" />
                            <div>
                                <p className="font-bold text-white">{user.name}</p>
                                <p className="text-gray-400 text-sm">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => approveUser(user.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold transition-colors"
                            >
                                <Check size={18} /> Aprobar
                            </button>
                            <button 
                                onClick={() => rejectUser(user.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors"
                            >
                                <X size={18} /> Rechazar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Active Users List (Read Only) */}
      <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-400 mb-4">Socios Activos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allUsers.filter(u => u.status === 'active').map(user => (
                  <div key={user.id} className="bg-cine-gray p-4 rounded border border-gray-800 flex items-center gap-3 opacity-70">
                      <img src={user.avatarUrl} className="w-8 h-8 rounded-full" />
                      <span className="text-white">{user.name}</span>
                      {user.isAdmin && <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded ml-auto">Admin</span>}
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;
