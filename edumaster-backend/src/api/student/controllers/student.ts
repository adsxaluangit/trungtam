/**
 * student controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::student.student', ({ strapi }) => ({

  // Endpoint: GET /api/students/check-duplicate
  // Kiểm tra học viên đã đăng ký lớp này chưa dựa vào id_number + class_id
  // Params: ?id_number=<cccd>&class_id=<documentId>&exclude_student_id=<documentId optional>
  async checkDuplicate(ctx) {
    try {
      const { id_number, class_id, exclude_student_id } = ctx.query as any;

      if (!id_number || !class_id) {
        return { exists: false, count: 0, students: [] };
      }

      const knex = strapi.db.connection;

      let query = knex('students as s')
        .join('students_school_class_lnk as lnk', 's.id', 'lnk.student_id')
        .join('classes as cls', 'cls.id', 'lnk.school_class_id')
        .where(function() {
          this.where('s.id_number', id_number)
            .orWhere('s.student_code', id_number)
            .orWhere('s.card_number', id_number);
        })
        .where('cls.document_id', class_id)
        .select('s.id', 's.document_id as documentId', 's.full_name', 's.id_number', 'cls.name as class_name');

      // Khi đang edit, loại bỏ chính học viên đó khỏi kết quả
      if (exclude_student_id) {
        query = query.whereNot('s.document_id', exclude_student_id);
      }

      const rows = await query;

      return {
        exists: rows.length > 0,
        count: rows.length,
        students: rows.map((r: any) => ({
          id: r.documentId,
          fullName: r.full_name,
          idNumber: r.id_number,
          className: r.class_name,
        }))
      };
    } catch (err: any) {
      console.error('[checkDuplicate]', err);
      // Không throw — trả về false để không block UX khi backend lỗi
      return { exists: false, count: 0, students: [] };
    }
  },

  // Endpoint: GET /api/students/unassigned
  // Returns paginated students NOT in any OPENING or RECOGNITION decision
  async findUnassigned(ctx) {
    try {
      const { page = 1, pageSize = 50, filters = {}, populate = '*' } = ctx.query;
      const pageNum = parseInt(page as string, 10);
      const limit = parseInt(pageSize as string, 10);
      const offset = (pageNum - 1) * limit;

      const knex = strapi.db.connection;
      
      // NOT EXISTS is much faster than NOT IN at large scale (500k+ rows)
      // NOT IN: O(n*m) scan; NOT EXISTS: O(n*log m) with index
      let baseQuery = knex('students')
        .whereNotExists(function() {
          this.select(knex.raw('1'))
            .from('class_decisions_students_lnk as lnk')
            .join('class_decisions as cd', 'cd.id', 'lnk.class_decision_id')
            .whereRaw('lnk.student_id = students.id')
            .whereIn('cd.type', ['OPENING', 'RECOGNITION'])
            .whereNotNull('lnk.student_id');
        });

      if (filters && typeof filters === 'object') {
        const anyFilters = filters as any;

        // Handle text search: filters[$or][0][full_name][$containsi] or filters[$or][1][id_number][$contains]
        if (anyFilters['$or'] && Array.isArray(anyFilters['$or'])) {
           const orFilter = anyFilters['$or'];
           let term = '';
           if (orFilter[0]?.full_name?.$containsi) term = orFilter[0].full_name.$containsi;
           else if (orFilter[1]?.id_number?.$contains) term = orFilter[1].id_number.$contains;

           if (term) {
             const searchTerm = `%${term}%`;
             baseQuery = baseQuery.where((builder: any) => {
                 builder.where('students.full_name', 'ilike', searchTerm)
                        .orWhere('students.id_number', 'ilike', searchTerm)
                        .orWhere('students.student_code', 'ilike', searchTerm);
             });
           }
        }

        // Handle old group filter (kept for backward compat)
        if (anyFilters['group'] && anyFilters['group']['$eq']) {
           baseQuery = baseQuery.where('students.group', anyFilters['group']['$eq']);
        }

        // Handle school_class.name filter: filters[school_class][name][$eq]=ClassName
        if (anyFilters['school_class'] && anyFilters['school_class']['name'] && anyFilters['school_class']['name']['$eq']) {
           const className = anyFilters['school_class']['name']['$eq'];
           baseQuery = baseQuery
             .join('students_school_class_lnk as sc_lnk', 'students.id', 'sc_lnk.student_id')
             .join('classes as cls', 'cls.id', 'sc_lnk.school_class_id')
             .where('cls.name', className);
        }
      }

      const studentIdsRecords = await baseQuery.clone()
        .select('students.document_id')
        .orderBy('students.created_at', 'desc')
        .limit(limit)
        .offset(offset);
      const documentIds = studentIdsRecords.map((r: any) => r.document_id);

      let formattedStudents: any[] = [];
      if (documentIds.length > 0) {
        const rawEntities = await strapi.documents('api::student.student').findMany({
            filters: { documentId: { $in: documentIds } },
            populate: populate as any
        });
        formattedStudents = documentIds.map(
          (docId: string) => (rawEntities as any[]).find(s => s.documentId === docId)
        ).filter(Boolean);
      }

      const countRes: any = await baseQuery.clone().clearSelect().count('* as count').first();
      const total = countRes ? parseInt((countRes as any).count as string, 10) : 0;

      return {
          data: formattedStudents,
          meta: {
              pagination: {
                  page: pageNum,
                  pageSize: limit,
                  pageCount: Math.ceil(total / limit),
                  total
              }
          }
      };
    } catch (err: any) {
      console.error(err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  },

  // Endpoint: GET /api/students/all-brief
  // Returns ALL students with minimal fields for dropdowns (no pagination)
  // Performance: loads in batches of 500, returns only needed columns
  async findAllBrief(ctx) {
    try {
      const knex = strapi.db.connection;
      
      // Direct SQL for maximum performance — only select needed columns
      const rows = await knex('students as s')
        .leftJoin('students_school_class_lnk as lnk', 's.id', 'lnk.student_id')
        .leftJoin('classes as c', 'c.id', 'lnk.class_id')
        .select(
          's.id',
          's.document_id as documentId',
          's.student_code',
          's.full_name',
          's.first_name',
          's.last_name',
          's.dob',
          's.pob',
          's.gender',
          's.id_number',
          's.group',
          's.class_code',
          's.company',
          's.phone',
          's.is_approved',
          'c.document_id as class_document_id',
          'c.name as class_name',
          'c.code as class_code_ref'
        )
        .orderBy('s.full_name', 'asc');

      const data = rows.map((r: any) => ({
        id: r.id,
        documentId: r.documentId,
        student_code: r.student_code,
        full_name: r.full_name,
        first_name: r.first_name,
        last_name: r.last_name,
        dob: r.dob,
        pob: r.pob,
        gender: r.gender,
        id_number: r.id_number,
        group: r.class_name || r.group || '',
        class_code: r.class_code_ref || r.class_code || '',
        class_name: r.class_name || '',
        class_document_id: r.class_document_id || '',
        company: r.company,
        phone: r.phone,
        is_approved: r.is_approved,
        photo: null,
        documents: []
      }));

      return {
        data,
        meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } }
      };
    } catch (err: any) {
      console.error(err);
      ctx.throw(500, err.message || 'Internal Server Error');
    }
  }
}));
