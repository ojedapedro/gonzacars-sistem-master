
import React, { useState } from 'react';
import { ShieldCheck, UserPlus, Search, Edit3, Trash2, Key, Shield, User as UserIcon, X, Check } from 'lucide-react';
import { User, UserRole } from '../types';

const UserManagement: React.FC<{ store: any }> = ({ store }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    email: '',
    name: '',
    role: 'vendedor'
  });

  const filteredUsers = store.users.filter((u: User) => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAdd = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', email: '', name: '', role: 'vendedor' });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (id === store.currentUser?.id) {
      alert("No puedes eliminar tu propio usuario mientras estás en sesión.");
      return;
    }
    if (confirm("¿Estás seguro de que deseas eliminar este usuario? Perderá el acceso de inmediato.")) {
      store.deleteUser(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      store.updateUser({ ...editingUser, ...formData } as User);
      alert("Usuario actualizado correctamente");
    } else {
      const newUser: User = {
        ...formData as User,
        id: Math.random().toString(36).substr(2, 9)
      };
      store.addUser(newUser);
      alert("Usuario creado correctamente");
    }
    setShowModal(false);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'administrador': return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
      case 'vendedor': return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
      case 'cajero': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
      case 'mecanico': return 'bg-orange-500/15 text-orange-400 border-orange-500/20';
      default: return 'bg-white/5 text-chrome-400 border-metal-border';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-3xl font-black text-chrome-100 tracking-tighter uppercase">Gestión de Accesos</h3>
          <p className="text-chrome-500 font-medium">Administre las credenciales y permisos del personal</p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" size={18}/>
            <input 
              type="text" 
              placeholder="Buscar usuario..." 
              className="w-full pl-10 pr-4 py-2 bg-metal-mid border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500/40 transition-all font-bold text-sm text-chrome-200 placeholder:text-chrome-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openAdd}
            className="btn-chrome px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
          >
            <UserPlus size={18}/> Crear Usuario
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-metal-border overflow-hidden surface-raised">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-metal-border" style={{ background: 'rgba(16,19,26,0.6)' }}>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Nombre Completo</th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Usuario / Correo</th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Rol / Nivel</th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest">Contraseña</th>
              <th className="px-8 py-5 text-[10px] font-black text-chrome-500 uppercase tracking-widest text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-metal-border">
            {filteredUsers.map((u: User) => (
              <tr key={u.id} className="hover:bg-white/3 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-chrome-500 uppercase transition-all" style={{ background: 'linear-gradient(145deg, #1c2030, #161922)', border: '1px solid #2a2f42' }}>
                      {u.name.charAt(0)}
                    </div>
                    <span className="font-black text-chrome-200 uppercase text-sm tracking-tight">{u.name}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-chrome-300 font-mono">{u.username}</span>
                    {u.email && <span className="text-[10px] font-bold text-chrome-500">{u.email}</span>}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getRoleBadge(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2 text-chrome-500">
                    <Key size={14}/>
                    <span className="text-[8px] font-black tracking-[0.4em]">••••••••</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => openEdit(u)}
                      className="p-2 text-chrome-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                      title="Editar Usuario"
                    >
                      <Edit3 size={18}/>
                    </button>
                    <button 
                      onClick={() => handleDelete(u.id)}
                      className={`p-2 rounded-lg transition-all ${u.id === store.currentUser?.id ? 'text-chrome-500/30 cursor-not-allowed' : 'text-chrome-500 hover:text-red-400 hover:bg-red-500/10'}`}
                      title={u.id === store.currentUser?.id ? "Sesión activa" : "Eliminar Usuario"}
                      disabled={u.id === store.currentUser?.id}
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
             <ShieldCheck size={64} className="text-metal-lighter mb-4" />
             <p className="text-sm font-black text-chrome-500 uppercase tracking-widest">No se encontraron usuarios</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="rounded-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300" style={{ background: 'linear-gradient(180deg, #161922, #0c0e14)', border: '1px solid #2a2f42', boxShadow: '0 16px 64px rgba(0,0,0,0.6)' }}>
            <div className="p-8 relative" style={{ background: 'linear-gradient(180deg, #1c2030, #161922)', borderBottom: '1px solid #2a2f42' }}>
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Shield size={120} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter relative z-10 text-chrome-100">
                {editingUser ? 'Editar Perfil' : 'Nuevo Colaborador'}
              </h3>
              <p className="text-chrome-500 text-[10px] font-black uppercase tracking-widest mt-1 relative z-10">
                Asignación de privilegios de sistema
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-chrome-500" size={16}/>
                  <input 
                    required 
                    type="text" 
                    placeholder="Ej: Pedro Pérez"
                    className="w-full pl-12 pr-4 py-3.5 bg-metal-dark border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500/40 font-bold transition-all text-chrome-200 placeholder:text-chrome-500"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Usuario</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="pperez"
                    className="w-full px-4 py-3.5 bg-metal-dark border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500/40 font-bold transition-all lowercase text-chrome-200 placeholder:text-chrome-500"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Correo (Google Login)</label>
                  <input 
                    type="email" 
                    placeholder="ejemplo@gmail.com"
                    className="w-full px-4 py-3.5 bg-metal-dark border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500/40 font-bold transition-all lowercase text-chrome-200 placeholder:text-chrome-500"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Contraseña</label>
                <input 
                  required={!editingUser}
                  type="password" 
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-metal-dark border border-metal-border rounded-xl outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500/40 font-bold transition-all text-chrome-200 placeholder:text-chrome-500"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-chrome-500 uppercase tracking-widest ml-1">Rol en la Empresa</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['administrador', 'vendedor', 'cajero', 'mecanico'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({...formData, role: r})}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${formData.role === r 
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-lg' 
                        : 'bg-metal-dark text-chrome-500 border-metal-border hover:border-chrome-500/30'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-4 text-chrome-500 font-black uppercase text-[10px] tracking-widest hover:text-chrome-300 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-chrome flex-[1.5] py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check size={18}/> {editingUser ? 'Guardar Cambios' : 'Registrar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
