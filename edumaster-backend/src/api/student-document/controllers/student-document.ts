/**
 * student-document controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::student-document.student-document', ({ strapi }) => ({

  // GET /api/student-documents/by-id-number?id_number=<cccd>
  // Trả về tất cả tài liệu thuộc CCCD này — dùng chung cho mọi lớp của 1 học viên
  async findByIdNumber(ctx) {
    try {
      const { id_number } = ctx.query as any;

      if (!id_number) {
        return ctx.badRequest('Thiếu tham số id_number');
      }

      const knex = strapi.db.connection;

      const rows = await knex('student_documents as sd')
        .where('sd.id_number', id_number)
        .select(
          'sd.id',
          'sd.document_id as documentId',
          'sd.name',
          'sd.url',
          'sd.type',
          'sd.date',
          'sd.id_number',
          'sd.created_at as createdAt'
        )
        .orderBy('sd.created_at', 'asc');

      return {
        data: rows.map((r: any) => ({
          id: r.documentId || r.id,
          name: r.name,
          url: r.url,
          type: r.type,
          date: r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''),
          id_number: r.id_number,
        }))
      };
    } catch (err: any) {
      console.error('[findByIdNumber]', err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  },

  // POST /api/student-documents/replace-or-create
  // Nếu đã có document cùng tên + CCCD → cập nhật URL (không tạo file mới)
  // Nếu chưa có → tạo mới bình thường
  // Body: { name, url, type, date, id_number, student }
  async replaceOrCreate(ctx) {
    try {
      const body = ctx.request.body as any;
      const { name, url, type, date, id_number, student } = body;

      if (!name || !url) {
        return ctx.badRequest('Thiếu name hoặc url');
      }

      const knex = strapi.db.connection;

      // Chỉ áp dụng logic thay thế khi có id_number VÀ tên cố định
      if (id_number) {
        const existing = await knex('student_documents')
          .where({ id_number, name })
          .orderBy('created_at', 'desc')
          .first();

        if (existing) {
          // Cập nhật URL mới vào record cũ, giữ nguyên mọi thứ khác
          await knex('student_documents')
            .where({ id: existing.id })
            .update({ url, type: type || existing.type, updated_at: new Date() });

          return {
            data: {
              id: existing.document_id || existing.id,
              name: existing.name,
              url,
              type: type || existing.type,
              date: existing.date,
              id_number: existing.id_number,
              replaced: true // flag để frontend biết là đã thay thế
            }
          };
        }
      }

      // Chưa có record phù hợp → tạo mới qua Strapi documents API
      const newDoc = await strapi.documents('api::student-document.student-document').create({
        data: {
          name,
          url,
          type: type || '',
          date: date || new Date().toLocaleDateString('vi-VN'),
          id_number: id_number || '',
          student: student ? Number(student) : undefined,
          publishedAt: new Date().toISOString()
        } as any
      });

      return {
        data: {
          id: (newDoc as any).documentId || (newDoc as any).id,
          name: (newDoc as any).name,
          url: (newDoc as any).url,
          type: (newDoc as any).type,
          date: (newDoc as any).date,
          id_number: (newDoc as any).id_number,
          replaced: false
        }
      };
    } catch (err: any) {
      console.error('[replaceOrCreate]', err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  }
}));
