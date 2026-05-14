import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, trackCourseView } from '../lib/firebase';
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
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Busca cursos por título o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg py-4 pl-12 pr-4 focus:ring-2 focus:ring-brand focus:border-transparent transition-all outline-none text-lg shadow-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg p-4 space-y-4 animate-pulse">
              <div className="aspect-video bg-gray-100 rounded-lg" />
              <div className="h-6 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <motion.div
              layoutId={course.id}
              key={course.id}
              onClick={() => { if (course.published !== false) { trackCourseView(course.id); onPlay(course); } }}
              className={`bg-white rounded-lg overflow-hidden border border-gray-200 transition-all shadow-sm ${
                course.published !== false 
                  ? 'hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 cursor-pointer group' 
                  : 'opacity-75 cursor-not-allowed'
              }`}
            >
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={course.thumbnailUrl || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60`} 
                  alt={course.title}
                  className={`w-full h-full object-cover transition-transform duration-500 ${course.published !== false ? 'group-hover:scale-105' : ''}`}
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <div className="bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-brand">
                    {course.category}
                  </div>
                  {course.published === false && (
                    <div className="bg-yellow-500 text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      Próximamente
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5">
                <h3 className={`text-lg font-display font-bold text-gray-900 transition-colors line-clamp-1 mb-2 ${course.published !== false ? 'group-hover:text-brand' : ''}`}>
                  {course.title}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10">
                  {course.description}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                    <Clock size={14} />
                    {course.duration}
                  </div>
                  {course.published !== false ? (
                    <button className="text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Ver video
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      En preparación
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-xl mb-4">
            <Search className="text-gray-300" size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No encontramos resultados</h3>
          <p className="text-gray-500">Intenta con otros términos de búsqueda.</p>
        </div>
      )}
    </div>
  );
}
