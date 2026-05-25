import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { Chapter, Course } from '../types';
import { Plus, Video, Image as ImageIcon, Type, FileText, Clock, Hash, Check, Lock, Trash2, Upload, AlertCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AdminStats from './AdminStats';

interface AdminPanelProps {
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  view: 'list' | 'create' | 'stats';
  onViewChange: (view: 'list' | 'create' | 'stats') => void;
}

export default function AdminPanel({ isAdmin, setIsAdmin, view, onViewChange }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnailUrl: '',
    duration: '',
    category: '',
    published: true
  });

  const [chapters, setChapters] = useState<Omit<Chapter, 'id'>[]>([
    { title: 'Introducción', text: '', videoUrl: '' }
  ]);

  const [uploadingChapterIndex, setUploadingChapterIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.title.trim()) newErrors.title = 'El título es obligatorio';
    if (!formData.category.trim()) newErrors.category = 'La categoría es obligatoria';
    
    if (chapters.length === 0) {
      newErrors.chapters = 'Debes añadir al menos un capítulo';
    } else {
      chapters.forEach((chapter, index) => {
        if (!chapter.title.trim()) {
          newErrors[`chapter_${index}_title`] = 'El título del capítulo es obligatorio';
        }
        if (!chapter.videoUrl.trim()) {
          newErrors[`chapter_${index}_video`] = 'El vídeo es obligatorio para cada capítulo';
        } else if (!chapter.videoUrl.trim().startsWith('http')) {
          newErrors[`chapter_${index}_video`] = 'Por favor, introduce una URL de vídeo válida (http/https)';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fetch courses for everyone to see the list
  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      console.error("Error fetching courses:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
      } else {
        setAuthError(data.message || 'Error de autenticación');
      }
    } catch (err) {
      setAuthError('Error al conectar con el servidor');
    } finally {
      setVerifying(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este curso?')) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    // If we want to restrict to webm, we can keep this, or open up to mp4 etc.
    // Let's allow standard formats.
    const validTypes = ['video/webm', 'video/mp4', 'video/mov', 'video/quicktime'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.webm') && !file.name.endsWith('.mp4')) {
      alert('Solo se permiten archivos de vídeo válidos (.webm, .mp4)');
      return;
    }

    const courseName = formData.title || 'untitled-course';

    setUploadingChapterIndex(index);
    setUploadProgress(0);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("courseName", courseName);

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const newChapters = [...chapters];
              newChapters[index].videoUrl = response.fileUrl;
              setChapters(newChapters);
              setUploadingChapterIndex(null);
              setUploadProgress(0);
              resolve();
            } catch (err) {
              setUploadingChapterIndex(null);
              reject(new Error("Error parsing server response"));
            }
          } else {
            console.error("Upload error status:", xhr.statusText, xhr.responseText);
            setUploadingChapterIndex(null);
            reject(new Error(`Upload failed: ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => {
          console.error("Upload error network");
          setUploadingChapterIndex(null);
          reject(new Error("Network error during upload"));
        };

        xhr.open("POST", "/api/upload");
        xhr.send(formDataUpload);
      });

    } catch (error: any) {
      console.error("Error in upload:", error);
      alert("Error al subir el video. Revisa la consola. " + error?.message);
      setUploadingChapterIndex(null);
    }
  };

  const addChapter = () => {
    setChapters([...chapters, { title: '', text: '', videoUrl: '' }]);
  };

  const removeChapter = (index: number) => {
    if (chapters.length === 1) return;
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const updateChapter = (index: number, field: keyof Omit<Chapter, 'id'>, value: string) => {
    const newChapters = [...chapters];
    (newChapters[index] as any)[field] = value;
    setChapters(newChapters);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setFormData({
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      duration: course.duration,
      category: course.category,
      published: course.published ?? true
    });
    setChapters(course.chapters);
    onViewChange('create');
  };

  const handleCancel = () => {
    setEditingCourseId(null);
    setFormData({
      title: '',
      description: '',
      thumbnailUrl: '',
      duration: '',
      category: '',
      published: true
    });
    setChapters([{ title: 'Introducción', text: '', videoUrl: '' }]);
    setErrors({});
    onViewChange('list');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = document.querySelector('.text-red-500');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (uploadingChapterIndex !== null) {
      alert("Por favor, espera a que termine de subir el vídeo antes de publicar el curso.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // Map chapters to include a generated ID if they don't have one
      const chaptersWithIds = chapters.map((c, i) => ({
        ...c,
        id: (c as any).id || `ch-${Date.now()}-${i}`
      }));

      const now = serverTimestamp();
      const courseData: any = {
        title: formData.title,
        description: formData.description,
        thumbnailUrl: formData.thumbnailUrl,
        duration: formData.duration,
        category: formData.category,
        published: formData.published,
        chapters: chaptersWithIds,
        updatedAt: now
      };

      if (editingCourseId) {
        await setDoc(doc(db, 'courses', editingCourseId), courseData, { merge: true });
      } else {
        await addDoc(collection(db, 'courses'), {
          ...courseData,
          createdAt: now
        });
      }

      setSuccess(true);
      setEditingCourseId(null);
      setFormData({
        title: '',
        description: '',
        thumbnailUrl: '',
        duration: '',
        category: '',
        published: true
      });
      setChapters([{ title: 'Introducción', text: '', videoUrl: '' }]);
      
      setTimeout(() => {
        setSuccess(false);
        onViewChange('list');
      }, 2000);
    } catch (error) {
      console.error("Error saving course:", error);
      handleFirestoreError(error, editingCourseId ? OperationType.WRITE : OperationType.CREATE, 'courses');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && view === 'list') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/50"
        >
          <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-gray-200">
            <Lock className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-display font-bold text-center mb-2">Gestión de Cursos</h1>
          <p className="text-gray-500 text-center mb-8">Introduce la contraseña de administrador para gestionar los cursos existentes.</p>
          
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              autoFocus
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 focus:bg-white focus:ring-2 focus:ring-brand outline-none transition-all text-center text-lg tracking-widest"
            />
            {authError && (
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium justify-center">
                <AlertCircle size={16} />
                {authError}
              </div>
            )}
            <button
              disabled={verifying}
              className="w-full bg-brand hover:bg-brand/90 text-white py-4 rounded-lg font-bold transition-all shadow-lg shadow-brand/20 active:scale-[0.98]"
            >
              {verifying ? 'Verificando...' : 'Acceder a Gestión'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <button 
              onClick={() => onViewChange('create')}
              className="text-brand font-bold hover:underline"
            >
              O simplemente crea un nuevo curso →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {view === 'stats' ? (
        <AdminStats />
      ) : view === 'list' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">Gestión de Cursos</h1>
              <p className="text-gray-500">Administra el catálogo de formación de la plataforma.</p>
            </div>
            <button
              onClick={() => onViewChange('create')}
              className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all"
            >
              <Plus size={20} />
              Crear Nuevo Curso
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {courses.length > 0 ? (
              courses.map(course => (
                <div key={course.id} className="bg-white p-6 rounded-xl border border-gray-200 flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-24 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={course.thumbnailUrl || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{course.title}</h3>
                      {!course.published && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-black uppercase">Borrador</span>
                      )}
                    </div>
                    <p className="text-xs text-brand font-bold uppercase tracking-widest">{course.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEditCourse(course)}
                      className="p-3 text-gray-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                    >
                      <Settings size={20} />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => deleteCourse(course.id)}
                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                <Video size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-500">No hay cursos publicados todavía.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-10 bg-gray-50/50 p-8 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg shadow-gray-200">
                {editingCourseId ? <Settings className="text-white" size={28} /> : <Plus className="text-white" size={28} />}
              </div>
              <div>
                <h1 className="text-2xl font-display font-black text-gray-900">
                  {editingCourseId ? 'Editar Curso' : 'Nuevo Curso'}
                </h1>
                <p className="text-gray-500 text-sm font-medium">
                  {editingCourseId ? 'Actualiza los contenidos existentes.' : 'Define el contenido de formación.'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleCancel}
              className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
            >
              Cancelar
            </button>
          </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Global Metadata */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Type size={14} /> Título del curso
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (errors.title) setErrors({ ...errors, title: '' });
                  }}
                  className={`w-full bg-gray-50 border rounded-lg px-4 py-3 focus:bg-white focus:ring-2 outline-none transition-all ${
                    errors.title ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-100 focus:ring-brand/20 focus:border-brand/30'
                  }`}
                />
                {errors.title && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Hash size={14} /> Categoría
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ventas, Tecnología..."
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({ ...formData, category: e.target.value });
                    if (errors.category) setErrors({ ...errors, category: '' });
                  }}
                  className={`w-full bg-gray-50 border rounded-xl px-4 py-3 focus:bg-white focus:ring-2 outline-none transition-all ${
                    errors.category ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-100 focus:ring-brand/20 focus:border-brand/30'
                  }`}
                />
                {errors.category && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors.category}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <FileText size={14} /> Descripción General
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand/30 outline-none transition-all h-24 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <ImageIcon size={14} /> URL de la Miniatura
                </label>
                <input
                  type="url"
                  value={formData.thumbnailUrl}
                  onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 focus:bg-white focus:ring-2 focus:ring-brand outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Clock size={14} /> Duración total
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 focus:bg-white focus:ring-2 focus:ring-brand outline-none transition-all"
                  placeholder="Ej. 1h 30min"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Estado de Publicación</h3>
                <p className="text-sm text-gray-500">¿Quieres que este curso sea visible para todos los usuarios?</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, published: !formData.published })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                  formData.published ? 'bg-brand' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.published ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Chapters Management */}
          <div className="space-y-6 pt-10 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-display font-bold text-gray-900">Capítulos y Contenido</h2>
                <p className="text-sm text-gray-500">Agrega el texto y vídeos específicos de cada sección.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={addChapter}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  <Plus size={16} />
                  Nuevo Capítulo
                </button>
                {errors.chapters && <p className="text-red-500 text-[10px] font-bold uppercase">{errors.chapters}</p>}
              </div>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm mb-6">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold flex items-center gap-2"><AlertCircle size={16}/> Error de red (Falta configurar CORS en S3)</span>
                  <button type="button" onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">✕</button>
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap">{uploadError}</pre>
              </div>
            )}

            <div className="space-y-8">
              {chapters.map((chapter, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-100 relative group">
                  <button
                    type="button"
                    onClick={() => removeChapter(index)}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Título del Capítulo {index + 1}</label>
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => {
                          updateChapter(index, 'title', e.target.value);
                          if (errors[`chapter_${index}_title`]) {
                            const newErrs = { ...errors };
                            delete newErrs[`chapter_${index}_title`];
                            setErrors(newErrs);
                          }
                        }}
                        className={`w-full bg-white border rounded-lg px-4 py-3 focus:ring-2 outline-none ${
                          errors[`chapter_${index}_title`] ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand'
                        }`}
                        placeholder="Ej. Introducción al concepto"
                      />
                      {errors[`chapter_${index}_title`] && (
                        <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors[`chapter_${index}_title`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Texto / Transcripción</label>
                      <textarea
                        value={chapter.text}
                        onChange={(e) => updateChapter(index, 'text', e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-brand outline-none h-32 resize-none"
                        placeholder="Contenido teórico del capítulo..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between">
                        <span>Vídeo del Capítulo (.webm)</span>
                        {chapter.videoUrl && <span className="text-green-600">✓ Listo</span>}
                      </label>
                      <div className="flex gap-4 items-center">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={chapter.videoUrl}
                            onChange={(e) => {
                              updateChapter(index, 'videoUrl', e.target.value);
                              if (errors[`chapter_${index}_video`]) {
                                const newErrs = { ...errors };
                                delete newErrs[`chapter_${index}_video`];
                                setErrors(newErrs);
                              }
                            }}
                            className={`w-full bg-white border rounded-lg px-4 py-3 pr-12 focus:ring-2 outline-none text-sm ${
                              errors[`chapter_${index}_video`] ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand'
                            }`}
                            placeholder="URL del vídeo o sube uno -->"
                          />
                          <Video className="absolute right-4 top-3.5 text-gray-300" size={16} />
                        </div>
                        
                        <label className={`cursor-pointer w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                          uploadingChapterIndex === index ? 'bg-gray-200' : 'bg-gray-900 hover:bg-gray-800 text-white hover:scale-105 active:scale-95'
                        }`}>
                          <input
                            type="file"
                            className="hidden"
                            accept="video/webm,video/mp4,video/quicktime"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(index, file);
                                if (errors[`chapter_${index}_video`]) {
                                  const newErrs = { ...errors };
                                  delete newErrs[`chapter_${index}_video`];
                                  setErrors(newErrs);
                                }
                              }
                            }}
                          />
                          {uploadingChapterIndex === index ? (
                            <div className="text-[10px] font-bold">{Math.round(uploadProgress)}%</div>
                          ) : (
                            <Upload size={18} />
                          )}
                        </label>
                      </div>
                      {errors[`chapter_${index}_video`] && (
                        <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{errors[`chapter_${index}_video`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-lg font-bold transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] ${
              success 
                ? 'bg-green-500 text-white' 
                : 'bg-brand text-white hover:bg-brand/90 shadow-brand/20'
            }`}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : success ? (
              <>
                <Check size={24} />
                {editingCourseId ? 'Curso Actualizado Exitosamente' : 'Curso Publicado Exitosamente'}
              </>
            ) : (
              <>
                {editingCourseId ? <Check size={24} /> : <Plus size={24} />}
                {editingCourseId ? 'Guardar Cambios' : 'Crear Curso Completo'}
              </>
            ) }
          </button>
        </form>
      </div>
    )}
  </div>
);
}
