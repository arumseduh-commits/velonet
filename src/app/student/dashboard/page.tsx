"use client";

import React, { useState } from "react";
import { BookOpen, Trophy, PlayCircle, Clock, ChevronRight, Sparkles, BookMarked, Search } from "lucide-react";

// Mock Data
const MOCK_ENROLLED_COURSES = [
  {
    id: "c1",
    title: "Mastering React 19",
    instructor: "Sarah Drasner",
    progress: 75,
    totalModules: 12,
    completedModules: 9,
    thumbnail: "bg-gradient-to-br from-blue-500 to-cyan-600",
    lastAccessed: "2 hours ago"
  },
  {
    id: "c2",
    title: "Advanced UI/UX with Tailwind CSS",
    instructor: "Adam Wathan",
    progress: 40,
    totalModules: 10,
    completedModules: 4,
    thumbnail: "bg-gradient-to-br from-teal-400 to-emerald-600",
    lastAccessed: "1 day ago"
  },
];

const MOCK_AVAILABLE_COURSES = [
  {
    id: "a1",
    title: "Next.js Fullstack Masterclass",
    instructor: "Lee Robinson",
    level: "Advanced",
    duration: "15 hours",
    thumbnail: "bg-gradient-to-br from-slate-700 to-slate-900"
  },
  {
    id: "a2",
    title: "Figma to Code Transition",
    instructor: "Gary Simon",
    level: "Beginner",
    duration: "8 hours",
    thumbnail: "bg-gradient-to-br from-purple-500 to-pink-600"
  }
];

export default function StudentDashboardPage() {
  const [enrolledCourses, setEnrolledCourses] = useState(MOCK_ENROLLED_COURSES);
  
  // To test the empty state, you can uncomment this line:
  // const [enrolledCourses, setEnrolledCourses] = useState([]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Welcome back, Student! 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            Ready to continue your learning journey?
          </p>
        </div>
      </div>

      {/* Stats/Overview Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Active Courses</p>
            <p className="text-2xl font-bold text-white">{enrolledCourses.length}</p>
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Completed Courses</p>
            <p className="text-2xl font-bold text-white">4</p>
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Learning Hours</p>
            <p className="text-2xl font-bold text-white">124h</p>
          </div>
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-emerald-500" />
            My Enrolled Courses
          </h2>
        </div>

        {enrolledCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCourses.map((course) => (
              <div
                key={course.id}
                className="group bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] flex flex-col"
              >
                {/* Course Thumbnail */}
                <div className={`h-40 w-full ${course.thumbnail} relative`}>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                    <span className="px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-md text-xs font-medium text-white border border-white/10">
                      {course.completedModules} / {course.totalModules} Modules
                    </span>
                  </div>
                </div>

                {/* Course Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-white line-clamp-2 mb-1 group-hover:text-emerald-400 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">{course.instructor}</p>

                  <div className="mt-auto space-y-3">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Progress</span>
                        <span className="font-medium text-emerald-400">{course.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Last access: {course.lastAccessed}
                      </span>
                      <button className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg text-sm font-medium transition-all">
                        <PlayCircle className="w-4 h-4" />
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State for Enrolled Courses */
          <div className="bg-[#111827] border border-slate-800 border-dashed rounded-2xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No courses enrolled yet</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              You haven't enrolled in any courses. Explore our available courses and start learning today!
            </p>
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Sparkles className="w-5 h-5" />
              Browse Courses
            </button>
          </div>
        )}
      </div>

      {/* Available Courses / Recommendations */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recommended For You</h2>
          <button className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {MOCK_AVAILABLE_COURSES.map((course) => (
            <div
              key={course.id}
              className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-colors group cursor-pointer"
            >
              <div className={`h-32 w-full ${course.thumbnail}`} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-semibold uppercase tracking-wider">
                    {course.level}
                  </span>
                  <span className="text-xs text-slate-500">{course.duration}</span>
                </div>
                <h3 className="font-semibold text-white line-clamp-2 text-sm group-hover:text-emerald-400 transition-colors mb-1">
                  {course.title}
                </h3>
                <p className="text-xs text-slate-400">{course.instructor}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
