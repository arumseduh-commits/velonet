"use client";

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

// Mock Data
interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: "published" | "draft";
}

const initialCourses: Course[] = [
  {
    id: "1",
    title: "Introduction to React",
    slug: "intro-to-react",
    description: "Learn the basics of React and component-driven architecture.",
    status: "published",
  },
  {
    id: "2",
    title: "Advanced Tailwind CSS",
    slug: "advanced-tailwind",
    description: "Master utility-first CSS for complex and responsive layouts.",
    status: "draft",
  },
];

export default function AdminCoursesPage() {
  const { toast } = useDialog();
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTitle("");
    setSlug("");
    setDescription("");
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error("Title and Slug are required.");
      return;
    }

    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      slug,
      description,
      status: "draft",
    };

    setCourses((prev) => [newCourse, ...prev]);
    toast.success("Course created successfully!");
    handleCloseModal();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your course catalog.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </button>
      </div>

      {/* Table section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">Course Title</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">Slug</th>
                <th className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <div className="font-medium text-slate-900">{course.title}</div>
                    <div className="text-slate-500 truncate max-w-[200px] sm:max-w-xs text-xs mt-0.5">
                      {course.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-slate-600">
                    {course.slug}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        course.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {course.status}
                    </span>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No courses found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Create New Course</h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              <form id="create-course-form" onSubmit={handleCreateCourse} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                    Course Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                    placeholder="e.g. Master JavaScript"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="slug" className="block text-sm font-medium text-slate-700">
                    Slug
                  </label>
                  <input
                    type="text"
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                    placeholder="e.g. master-javascript"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm resize-none"
                    placeholder="Brief description about the course..."
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors w-full sm:w-auto text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-course-form"
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto text-center"
              >
                Create Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
