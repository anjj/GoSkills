import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, trackChapterView, trackCourseCompletion } from '../lib/firebase';
import { Course, Chapter, UserProgress } from '../types';
import { ArrowLeft, CheckCircle, Clock, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Check, ChevronRight, BookText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomVideoPlayerProps {
  src?: string;
  poster?: string;
  key?: React.Key;
}

function CustomVideoPlayer({ src, poster }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [presignedSrc, setPresignedSrc] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;
    const fetchPresignedUrl = async () => {
      if (!src) {
        setPresignedSrc(null);
        return;
      }
      
      if (src.includes('amazonaws.com')) {
        try {
          const res = await fetch('/api/video/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: src })
          });
          if (res.ok) {
            const data = await res.json();
            if (active) setPresignedSrc(data.presignedUrl);
          } else {
            console.error('Failed to get presigned URL');
            if (active) setPresignedSrc(src); // fallback
          }
        } catch (error) {
          console.error('Error fetching presigned URL', error);
          if (active) setPresignedSrc(src); // fallback
        }
      } else {
        if (active) setPresignedSrc(src);
      }
    };
    
    fetchPresignedUrl();
    
    return () => { active = false; };
  }, [src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handlePlayPause = () => {
    if (videoRef.current && src) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
          setHasError(true);
        });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      if (isMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(isNaN(currentProgress) ? 0 : currentProgress);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value) / 100;
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = newTime * videoRef.current.duration;
      setProgress(parseFloat(e.target.value));
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  if (!src) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-500 aspect-video">
        <BookText size={48} className="mb-4 opacity-50" />
        <p className="font-bold uppercase tracking-widest text-sm">Contenido solo de lectura</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-500 aspect-video">
        <p className="font-bold uppercase tracking-widest text-sm mb-2">Error al cargar el video</p>
        <p className="text-xs max-w-sm text-center">El formato no es compatible o el enlace es inválido.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full aspect-video bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {!presignedSrc && src && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10 text-brand">
           <div className="w-10 h-10 border-4 border-white/20 border-t-brand rounded-full animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        src={presignedSrc || undefined}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handlePlayPause}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onError={() => setHasError(true)}
      />
      
      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <input
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={handleProgressChange}
          className="w-full h-1 mb-4 accent-brand cursor-pointer appearance-none bg-white/30 rounded-full"
        />
        
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={handlePlayPause} className="hover:text-brand transition-colors">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            
            <div className="flex items-center gap-2 group/volume relative">
              <button onClick={toggleMute} className="hover:text-brand transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 accent-brand cursor-pointer appearance-none bg-white/30 rounded-full opacity-0 group-hover/volume:opacity-100 transition-opacity absolute left-8"
              />
            </div>
          </div>
          
          <button onClick={toggleFullscreen} className="hover:text-brand transition-colors">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {!isPlaying && (
        <button 
          onClick={handlePlayPause}
          className="absolute inset-0 m-auto w-16 h-16 bg-brand text-white rounded-full flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-110 transition-transform"
        >
          <Play size={32} className="ml-1" />
        </button>
      )}
    </div>
  );
}

interface VideoPlayerProps {
  course: Course;
  onBack: () => void;
}

export default function VideoPlayer({ course, onBack }: VideoPlayerProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  const [marking, setMarking] = useState(false);

  const chapters = course.chapters || [];
  const currentChapter = chapters[currentChapterIndex] || chapters[0] || {} as Chapter;

  useEffect(() => {
    const checkProgress = async () => {
      if (!auth.currentUser || chapters.length === 0) return;
      const progressRef = doc(db, 'users', auth.currentUser.uid, 'progress', course.id);
      try {
        const snap = await getDoc(progressRef);
        if (snap.exists()) {
          if (snap.data().completed) {
            setCompletedChapters(chapters.map(c => c.id));
          }
        }
      } catch (error) {
        console.error("Error checking progress:", error);
      }
    };
    checkProgress();
  }, [course.id, chapters]);

  useEffect(() => {
    if (chapters.length === 0 || !currentChapter.id) return;
    trackChapterView(course.id, currentChapter.id);
  }, [course.id, currentChapter.id]);

  const toggleCourseComplete = async () => {
    if (!auth.currentUser || chapters.length === 0) return;
    setMarking(true);
    const progressRef = doc(db, 'users', auth.currentUser.uid, 'progress', course.id);
    const isNowCompleted = completedChapters.length !== chapters.length;
    
    try {
      await setDoc(progressRef, {
        courseId: course.id,
        completed: isNowCompleted,
        completedAt: isNowCompleted ? new Date().toISOString() : null
      });
      trackCourseCompletion(course.id, isNowCompleted);
      setCompletedChapters(isNowCompleted ? chapters.map(c => c.id) : []);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/progress/${course.id}`);
    } finally {
      setMarking(false);
    }
  };

  const isCourseFinished = chapters.length > 0 && completedChapters.length === chapters.length;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-brand transition-colors mb-6 font-medium group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Volver al Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Player Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-100">
            <div className="aspect-video bg-black relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentChapter.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full"
                >
                  {(currentChapter.videoUrl || '').includes('youtube.com') || (currentChapter.videoUrl || '').includes('youtu.be') ? (
                    <iframe
                      src={currentChapter.videoUrl?.replace('watch?v=', 'embed/').split('&')[0]}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <CustomVideoPlayer 
                      src={currentChapter.videoUrl || undefined} 
                      key={currentChapter.videoUrl || 'empty'}
                      poster={course.thumbnailUrl}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Capítulo {currentChapterIndex + 1} de {chapters.length}
                </span>
              </div>
              <h1 className="text-3xl font-display font-bold text-gray-900 mb-6">{currentChapter.title}</h1>
              
              <div className="prose prose-brand max-w-none">
                <div className="flex items-center gap-2 text-gray-400 mb-4">
                  <BookText size={18} />
                  <span className="text-sm font-bold uppercase tracking-widest">Material de Lectura</span>
                </div>
                <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-wrap bg-gray-50 p-6 rounded-xl border border-gray-100">
                  {currentChapter.text || "No hay texto adicional para este capítulo."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Chapters List & Progress */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-display font-bold text-gray-900 mb-6 flex items-center justify-between">
              Contenido del Curso
              <span className="text-xs font-bold text-gray-400">{course.duration}</span>
            </h2>

            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  onClick={() => setCurrentChapterIndex(index)}
                  className={`w-full text-left p-4 rounded-lg transition-all flex items-center gap-3 group relative ${
                    currentChapterIndex === index 
                      ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    currentChapterIndex === index ? 'bg-white/20' : 'bg-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${currentChapterIndex === index ? 'text-white' : 'text-gray-900'}`}>
                      {chapter.title}
                    </p>
                  </div>
                  {currentChapterIndex === index && (
                    <motion.div layoutId="active-indicator" className="absolute right-4">
                      <ChevronRight size={18} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100">
              <button
                disabled={marking}
                onClick={toggleCourseComplete}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-lg font-bold transition-all shadow-md active:scale-[0.98] ${
                  isCourseFinished 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-brand hover:bg-brand/90 text-white'
                } ${marking ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {marking ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isCourseFinished ? (
                  <>
                    <CheckCircle size={20} />
                    Curso Completado
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Finalizar Curso
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-900 text-white p-6 rounded-xl shadow-xl">
            <h3 className="font-display font-bold mb-2">Sobre este curso</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              {course.description}
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-brand">
              <Clock size={14} />
              {course.duration} TOTAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
