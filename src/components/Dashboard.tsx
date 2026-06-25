import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Course } from '../types';
import { Search, Clock, Tag } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  onPlay: (course: Course) => void;
}

export default function Dashboard({ onPlay }: DashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'courses');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-ink-mute">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Busca cursos por título o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-bg border border-rule rounded-[3px] py-4 pl-12 pr-4 focus:ring-2 focus:ring-brand/20 focus:border-brand/30 transition-all outline-none text-lg shadow-xl shadow-ink/5"
        />
      </div>

      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-bg rounded-[3px] p-4 space-y-4 animate-pulse break-inside-avoid">
              <div className="aspect-video bg-bg-soft rounded-[3px]" />
              <div className="h-6 bg-bg-soft rounded w-3/4" />
              <div className="h-4 bg-bg-soft rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {filteredCourses.map((course) => (
            <motion.div
              layoutId={course.id}
              key={course.id}
              onClick={() => course.published !== false ? onPlay(course) : null}
              className={`bg-bg rounded-[3px] overflow-hidden border border-rule transition-all shadow-sm break-inside-avoid mb-6 ${
                course.published !== false 
                  ? 'hover:shadow-2xl hover:shadow-brand/10 cursor-pointer group hover:-translate-y-1'
                  : 'opacity-75 cursor-not-allowed'
              }`}
            >
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={course.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60`} 
                  alt={course.title}
                  className={`w-full h-full object-cover transition-transform duration-500 ${course.published !== false ? 'group-hover:scale-105' : ''}`}
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="bg-bg/90 backdrop-blur px-3 py-1.5 rounded-[3px] text-[10px] font-black uppercase tracking-widest text-brand shadow-sm">
                    {course.category}
                  </div>
                  {course.published === false && (
                    <div className="bg-yellow-500 text-white px-2 py-1 rounded-[3px] text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      Próximamente
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5">
                <h3 className={`text-lg  font-bold text-ink-strong transition-colors line-clamp-1 mb-2 ${course.published !== false ? 'group-hover:text-brand' : ''}`}>
                  {course.title}
                </h3>
                <p className="text-ink-soft text-sm line-clamp-2 mb-4 h-10">
                  {course.description}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-rule-soft">
                  <div className="flex items-center gap-1.5 text-xs text-ink-mute font-medium">
                    <Clock size={14} />
                    {course.duration}
                  </div>
                  {course.published !== false ? (
                    <button className="text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Ver video
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-ink-mute uppercase tracking-widest">
                      En preparación
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-bg rounded-[3px] border border-dashed border-rule">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-bg-alt rounded-[3px] mb-4">
            <Search className="text-ink-mute" size={32} />
          </div>
          <h3 className="text-lg font-bold text-ink-strong">No encontramos resultados</h3>
          <p className="text-ink-soft">Intenta con otros términos de búsqueda.</p>
        </div>
      )}
    </div>
  );
}
