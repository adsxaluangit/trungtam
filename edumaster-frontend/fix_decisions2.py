import io

file_path = r'd:\Github\edumaster\edumaster-frontend\views\DecisionsView.tsx'
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """    if (d.type === 'OPENING' && d.classId) {
      setLoading(true);
      loadStudentsByClass(d.classId).then(classStudents => {
        const approvedStudents = classStudents.filter(s => (s as any).isApproved === true);
        setAllStudents(approvedStudents);
        setLoading(false);
      });
    }
  };"""

replacement1 = """    if (d.type === 'OPENING' && d.classId) {
      setLoading(true);
      loadStudentsByClass(d.classId).then(classStudents => {
        const approvedStudents = classStudents.filter(s => (s as any).isApproved === true);
        setAllStudents(approvedStudents);
        setLoading(false);
      });
    }
  };

  const handleOpenAddStudentModal = () => {
    if (viewType === 'OPENING' && formData.classId) {
      setLoading(true);
      loadStudentsByClass(formData.classId).then(classStudents => {
        const approvedStudents = classStudents.filter(s => (s as any).isApproved === true);
        setAllStudents(approvedStudents);
        setLoading(false);
        setIsAddStudentModalOpen(true);
      });
    } else {
      setIsAddStudentModalOpen(true);
    }
  };"""

target2 = """              {currentUser?.role === UserRole.ADMIN && (
                <button
                  onClick={() => setIsAddStudentModalOpen(true)}
                  className="bg-slate-800 text-white px-4 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-sm"
                >"""

replacement2 = """              {currentUser?.role === UserRole.ADMIN && (
                <button
                  onClick={handleOpenAddStudentModal}
                  className="bg-slate-800 text-white px-4 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-sm"
                >"""

content = content.replace(target1, replacement1).replace(target2, replacement2)

with io.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("File updated successfully.")
