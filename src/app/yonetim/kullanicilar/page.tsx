"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

export default function KullanicilarPage() {
  type UserRole = { id?: string; user_id?: string; role?: string; created_at?: string; email?: string | null };
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "controller">("controller");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Users fetch error:", error);
        alert(`Kullanıcılar listelenemedi: ${error.message}`);
        return;
      }

      if (data) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Users fetch error:", error);
      alert(`Kullanıcılar listelenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  }

  // Kullanıcı ekleme fonksiyonu (Service role key gerekli)
  async function handleAddUser() {
    try {
      
      
      if (!newUserEmail) {
        alert("E-posta adresi giriniz!");
        return;
      }

      // Service role key kontrolü
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        alert("Kullanıcı oluşturmak için Supabase Service Role Key gerekli!\n\nLütfen .env.local dosyasına ekleyin:\nSUPABASE_SERVICE_ROLE_KEY=service_role_key_here");
        return;
      }

      // Service role key varsa bu kod çalışır:
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("List users error:", listError);
        alert("Kullanıcılar listelenemedi: " + listError.message);
        return;
      }
      
      const userExists = existingUsers.users?.some((user: { email?: string } ) => user.email === newUserEmail);
      
      if (userExists) {
        alert("Bu e-posta adresi zaten kayıtlı!");
        return;
      }

      

      const { data, error } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: Math.random().toString(36).substring(2, 15),
        email_confirm: true,
        user_metadata: {
          role: newUserRole,
          created_by: 'admin'
        }
      });

      

      if (error) {
        console.error("User creation error:", error);
        alert("Kullanıcı oluşturulamadı: " + error.message);
      } else {
        if (data.user?.id) {
          
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({
              user_id: data.user.id,
              role: newUserRole
            });

          if (roleError) {
            console.error("Role insertion error:", roleError);
            alert("Rol atanamadı: " + roleError.message);
          } else {
            
            alert("Kullanıcı başarıyla oluşturuldu!");
            setNewUserEmail("");
            setNewUserRole("controller");
            setShowAddForm(false);
            fetchUsers();
          }
        }
      }
    } catch (error) {
      console.error("Add user error:", error);
      alert("İşlem başarısız oldu: " + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  }

  async function removeRole(userId?: string, role?: string) {
    if (!userId || !role) {
      alert('Kullanıcı bilgisi eksik.');
      return;
    }
    if (!confirm(`Bu kullanıcının ${role === 'admin' ? 'yönetici' : 'kontrolör'} rolünü kaldırmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) {
        alert("Rol kaldırılamadı: " + error.message);
      } else {
        alert("Kullanıcı rolü başarıyla kaldırıldı.");
        fetchUsers();
      }
    } catch (error) {
      console.error("Remove role error:", error);
      alert("Bir hata oluştu.");
    }
  }

  // Sadece admin erişebilir - kontrolü devre dışı bırak
  // if (!isAdmin) {
  //   return (
  //     <div className="p-8">
  //       <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
  //         <Users className="h-12 w-12 text-red-600 mx-auto mb-4" />
  //         <h2 className="text-lg font-semibold text-red-800 mb-2">
  //           Erişim Reddedildi
  //         </h2>
  //         <p className="text-red-600">
  //           Bu sayfaya sadece yöneticiler erişebilir.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Kullanıcı Yönetimi
          </h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Rol Ekle
          </button>
        </div>

        {/* Rol Ekle Formu */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Yeni Kullanıcı Rolü
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="kullanici@ornek.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rol
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as "admin" | "controller")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="controller">Kontrolör</option>
                  <option value="admin">Yönetici</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddUser}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700"
              >
                Kullanıcı Ekle
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Kullanıcı Listesi */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Kullanıcı ID</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Rol</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Rol Tarihi</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">Kayıt Tarihi</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-700">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="p-4 text-sm text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium">{user.user_id}</div>
                          <div className="text-xs text-slate-500">
                            ID: {user.user_id ? String(user.user_id).slice(-8) : '-'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'admin' ? '🛡️ Yönetici' : '🔍 Kontrolör'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {'Hiç giriş yapmadı'}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {user.created_at 
                        ? new Date(user.created_at).toLocaleString("tr-TR")
                        : 'Bilinmiyor'
                      }
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {user.created_at 
                        ? new Date(user.created_at).toLocaleString("tr-TR")
                        : 'Bilinmiyor'
                      }
                    </td>
                    <td className="p-4 text-sm">
                      <button
                        onClick={() => removeRole(user.user_id, user.role)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Rolü kaldır"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
