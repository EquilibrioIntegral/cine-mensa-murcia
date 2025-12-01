
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Film, X, Mail } from 'lucide-react';

const Login: React.FC = () => {
  const { login, register, resetPassword } = useData();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    if (!email.includes('@')) {
        setMessage({ type: 'error', text: "Email inválido" });
        setLoading(false);
        return;
    }

    if (password.length < 6) {
        setMessage({ type: 'error', text: "La contraseña debe tener al menos 6 caracteres" });
        setLoading(false);
        return;
    }

    try {
        if (isRegistering) {
            if (!name) {
                setMessage({ type: 'error', text: "El nombre es obligatorio" });
                setLoading(false);
                return;
            }
            // Eliminado el paso del avatar. Se generará automático en DataContext.
            const result = await register(email, name, password);
            setMessage({ type: result.success ? 'success' : 'error', text: result.message });
            if (result.success && !result.message.includes('Administrador')) {
                // Stay on screen to show "Pending approval" message
            }
        } else {
            const result = await login(email, password);
            if (!result.success) {
                setMessage({ type: 'error', text: result.message });
            }
        }
    } catch (error: any) {
        setMessage({ type: 'error', text: "Error inesperado: " + error.message });
    } finally {
        setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmail) return;
      
      const res = await resetPassword(resetEmail);
      alert(res.message); // Simple alert or custom message
      if (res.success) {
          setShowResetModal(false);
          setResetEmail('');
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-cine-dark/90 backdrop-blur-sm"></div>
      
      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-cine-gray max-w-sm w-full rounded-xl border border-gray-700 shadow-2xl p-6 relative">
                  <button onClick={() => setShowResetModal(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white"><X size={20}/></button>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Mail className="text-cine-gold"/> Recuperar Cuenta</h3>
                  <p className="text-sm text-gray-400 mb-4">Introduce tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
                  <form onSubmit={handleResetSubmit}>
                      <input 
                        type="email" 
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full bg-black/40 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none mb-4"
                        required
                      />
                      <button type="submit" className="w-full bg-cine-gold text-black font-bold py-2 rounded hover:bg-white transition-colors">
                          Enviar Correo de Recuperación
                      </button>
                  </form>
              </div>
          </div>
      )}

      <div className="relative z-10 w-full max-w-md p-8 bg-black/60 border border-gray-800 rounded-2xl shadow-2xl backdrop-blur-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center mb-8">
            <div className="bg-cine-gold p-3 rounded-full mb-4">
                <Film size={32} className="text-black" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wider text-center">
                CINE MENSA <br/><span className="text-cine-gold">MURCIA</span>
            </h1>
            <p className="text-gray-400 text-sm mt-2">Acceso Exclusivo para Socios</p>
        </div>

        {message && (
            <div className={`mb-4 p-3 rounded text-sm text-center ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-green-900/50 text-green-200 border border-green-800'}`}>
                {message.text}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
                <div>
                    <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Nombre</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                        placeholder="Tu nombre cinéfilo"
                        required={isRegistering}
                    />
                    <p className="text-[10px] text-gray-500 mt-1 italic">*Podrás personalizar tu foto de perfil una vez dentro.</p>
                </div>
            )}
            <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                    placeholder="usuario@gmail.com"
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Contraseña</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-700 rounded p-3 text-white focus:border-cine-gold outline-none transition-colors"
                    placeholder="••••••••"
                    required
                />
            </div>

            {!isRegistering && (
                <div className="flex justify-end">
                    <button 
                        type="button" 
                        onClick={() => setShowResetModal(true)}
                        className="text-xs text-gray-400 hover:text-cine-gold transition-colors"
                    >
                        ¿Olvidaste tu contraseña?
                    </button>
                </div>
            )}

            <button 
                type="submit"
                disabled={loading}
                className="w-full bg-cine-gold text-black font-bold py-3 rounded hover:bg-white transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Procesando...' : (isRegistering ? 'Solicitar Registro' : 'Entrar al Cine')}
            </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setMessage(null); }}
                className="text-gray-400 text-sm hover:text-cine-gold underline"
            >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo socio? Solicita acceso'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
