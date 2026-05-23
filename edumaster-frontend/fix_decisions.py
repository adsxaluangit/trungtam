import io

file_path = r'd:\Github\edumaster\edumaster-frontend\views\DecisionsView.tsx'
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                        onClick={() => {
                          if (checkIfLocked(d.id)) {
                            alert("Quyết định này đã bị khóa (Đã có QĐ Công nhận). Bạn chỉ có thể xem, không thể sửa.");
                          }
                          setEditingId(d.id);
                          setFormData({
                            number: d.number, signedDate: d.signedDate, signer: d.signer,
                            location: d.location, company: d.company, classType: d.classType,
                            classCode: d.classCode, className: d.className, trainingCourse: d.trainingCourse, notes: d.notes, classId: d.classId || '', relatedOpeningId: d.relatedOpeningId || '', startIndex: '1'
                          });
                          setTempStudents(d.students || []);
                          setIsFormOpen(true);
                        }}"""

replacement1 = """                        onClick={(e) => handleOpenEditDecision(d, e as any)}"""

content = content.replace(target1, replacement1)

with io.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("File updated successfully.")
