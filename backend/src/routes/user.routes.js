const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Apply authentication middleware to all user routes
router.use(authenticate);

/**
 * GET /api/users
 * Get all users
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await db.execute(
      `
        SELECT id, name, email, role, is_active as isActive, created_at as createdAt,
               phone, department, employee_id as employeeId, emergency_contact as emergencyContact,
               blood_group as bloodGroup, date_of_birth as dateOfBirth,
               educational_qualification as educationalQualification, specialization,
               current_address as currentAddress, permanent_address as permanentAddress
        FROM users
        ORDER BY created_at DESC
      `
    );
    res.json({ success: true, data: users });
  })
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) throw new ValidationError('Invalid user id');

    const user = await db.executeOne(
      `
        SELECT id, name, email, role, is_active as isActive, created_at as createdAt,
               phone, department, employee_id as employeeId, emergency_contact as emergencyContact,
               blood_group as bloodGroup, date_of_birth as dateOfBirth,
               educational_qualification as educationalQualification, specialization,
               current_address as currentAddress, permanent_address as permanentAddress
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    if (!user) throw new NotFoundError('User not found');
    res.json({ success: true, data: user });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, password, role, phone, department, employeeId, emergencyContact,
            bloodGroup, dateOfBirth, educationalQualification, specialization,
            currentAddress, permanentAddress } = req.body || {};
    if (!name || !email || !password) {
      throw new ValidationError('name, email, and password are required');
    }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const result = await db.executeWithResult(
      `
        INSERT INTO users (name, email, password_hash, role, is_global_admin, is_active,
                          phone, department, employee_id, emergency_contact, blood_group,
                          date_of_birth, educational_qualification, specialization,
                          current_address, permanent_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [name, email, passwordHash, role || 'viewer', role === 'admin', true,
       phone || null, department || null, employeeId || null, emergencyContact || null,
       bloodGroup || null, dateOfBirth || null, educationalQualification || null,
       specialization || null, currentAddress || null, permanentAddress || null]
    );

    const created = await db.executeOne(
      `
        SELECT id, name, email, role, is_active as isActive, created_at as createdAt,
               phone, department, employee_id as employeeId, emergency_contact as emergencyContact,
               blood_group as bloodGroup, date_of_birth as dateOfBirth,
               educational_qualification as educationalQualification, specialization,
               current_address as currentAddress, permanent_address as permanentAddress
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'User created successfully', data: created });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) throw new ValidationError('Invalid user id');

    const { name, email, password, role, isActive, phone, department, employeeId, emergencyContact,
            bloodGroup, dateOfBirth, educationalQualification, specialization,
            currentAddress, permanentAddress } = req.body || {};

    // Convert empty strings to NULL for date fields
    const normalizedDateOfBirth = dateOfBirth === '' ? null : dateOfBirth;
    const existing = await db.executeOne('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
    if (!existing) throw new NotFoundError('User not found');

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (password !== undefined) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12));
    }
    if (role !== undefined) {
      updates.push('role = ?');
      updates.push('is_global_admin = ?');
      values.push(role);
      values.push(role === 'admin');
    }
    if (typeof isActive === 'boolean') {
      updates.push('is_active = ?');
      values.push(isActive);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (department !== undefined) {
      updates.push('department = ?');
      values.push(department);
    }
    if (employeeId !== undefined) {
      updates.push('employee_id = ?');
      values.push(employeeId);
    }
    if (emergencyContact !== undefined) {
      updates.push('emergency_contact = ?');
      values.push(emergencyContact);
    }
    if (bloodGroup !== undefined) {
      updates.push('blood_group = ?');
      values.push(bloodGroup);
    }
    if (dateOfBirth !== undefined) {
      updates.push('date_of_birth = ?');
      values.push(normalizedDateOfBirth);
    }
    if (educationalQualification !== undefined) {
      updates.push('educational_qualification = ?');
      values.push(educationalQualification);
    }
    if (specialization !== undefined) {
      updates.push('specialization = ?');
      values.push(specialization);
    }
    if (currentAddress !== undefined) {
      updates.push('current_address = ?');
      values.push(currentAddress);
    }
    if (permanentAddress !== undefined) {
      updates.push('permanent_address = ?');
      values.push(permanentAddress);
    }

    values.push(id);

    if (updates.length > 0) {
      await db.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const updated = await db.executeOne(
      `
        SELECT id, name, email, role, is_active as isActive, created_at as createdAt,
               phone, department, employee_id as employeeId, emergency_contact as emergencyContact,
               blood_group as bloodGroup, date_of_birth as dateOfBirth,
               educational_qualification as educationalQualification, specialization,
               current_address as currentAddress, permanent_address as permanentAddress
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json({ success: true, message: 'User updated successfully', data: updated });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) throw new ValidationError('Invalid user id');

    const result = await db.executeWithResult('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) throw new NotFoundError('User not found');

    res.json({ success: true, message: 'User deleted successfully', data: { id } });
  })
);

module.exports = router;
