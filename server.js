const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'leave-management-secret-2024';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, '.data', 'leave_system.db');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database(dbPath);

function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            student_no TEXT NOT NULL UNIQUE,
            class_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS teacher_classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            class_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
            UNIQUE(teacher_id, class_name)
        );

        CREATE TABLE IF NOT EXISTS leaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            reason TEXT NOT NULL,
            attachment_path TEXT DEFAULT NULL,
            status TEXT DEFAULT '待审批',
            teacher_comment TEXT DEFAULT NULL,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            approved_at TIMESTAMP NULL,
            approver_id INTEGER DEFAULT NULL,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (approver_id) REFERENCES teachers(id) ON DELETE SET NULL
        );
    `);

    const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get();
    if (studentCount.count === 0) {
        const password = bcrypt.hashSync('123456', 10);
        
        db.prepare('INSERT INTO students (username, password, name, student_no, class_name) VALUES (?, ?, ?, ?, ?)').run('student1', password, '张三', '2024001', '计算机2401班');
        db.prepare('INSERT INTO students (username, password, name, student_no, class_name) VALUES (?, ?, ?, ?, ?)').run('student2', password, '李四', '2024002', '计算机2401班');
        db.prepare('INSERT INTO students (username, password, name, student_no, class_name) VALUES (?, ?, ?, ?, ?)').run('student3', password, '王五', '2024003', '计算机2402班');
        
        db.prepare('INSERT INTO teachers (username, password, name) VALUES (?, ?, ?)').run('teacher1', password, '李老师');
        db.prepare('INSERT INTO teachers (username, password, name) VALUES (?, ?, ?)').run('teacher2', password, '王老师');
        
        db.prepare('INSERT INTO teacher_classes (teacher_id, class_name) VALUES (?, ?)').run(1, '计算机2401班');
        db.prepare('INSERT INTO teacher_classes (teacher_id, class_name) VALUES (?, ?)').run(1, '计算机2402班');
        db.prepare('INSERT INTO teacher_classes (teacher_id, class_name) VALUES (?, ?)').run(2, '计算机2402班');
        
        console.log('数据库初始化完成，测试账号已创建');
    }
}

initDatabase();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'token无效' });
        }
        req.user = user;
        next();
    });
};

app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        let user = null;
        const table = role === 'student' ? 'students' : 'teachers';
        user = db.prepare(`SELECT * FROM ${table} WHERE username = ?`).get(username);
        
        if (user) user.role = role;
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        
        const userData = { id: user.id, username: user.username, name: user.name, role: user.role };
        if (role === 'student') {
            userData.student_no = user.student_no;
            userData.class_name = user.class_name;
        }
        
        res.json({ success: true, message: '登录成功', token, user: userData });
    } catch (err) {
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    try {
        const table = req.user.role === 'student' ? 'students' : 'teachers';
        let user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.user.id);
        user.role = req.user.role;
        
        if (req.user.role === 'teacher') {
            const classes = db.prepare('SELECT class_name FROM teacher_classes WHERE teacher_id = ?').all(req.user.id);
            user.classes = classes.map(c => c.class_name);
        }
        
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取用户信息失败' });
    }
});

app.post('/api/leave/submit', authMiddleware, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const { leaveType, startTime, endTime, reason, attachmentPath } = req.body;
    
    if (leaveType === '病假' && !attachmentPath) {
        return res.status(400).json({ success: false, message: '病假需要上传证明' });
    }
    
    try {
        const result = db.prepare(`
            INSERT INTO leaves (student_id, leave_type, start_time, end_time, reason, attachment_path, status)
            VALUES (?, ?, ?, ?, ?, ?, '待审批')
        `).run(req.user.id, leaveType, startTime, endTime, reason, attachmentPath || null);
        
        res.json({ success: true, message: '提交成功', leaveId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ success: false, message: '提交失败' });
    }
});

app.get('/api/leave/my-leaves', authMiddleware, (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    try {
        const leaves = db.prepare(`
            SELECT l.*, s.name as student_name, s.student_no, s.class_name, t.name as approver_name
            FROM leaves l
            LEFT JOIN students s ON l.student_id = s.id
            LEFT JOIN teachers t ON l.approver_id = t.id
            WHERE l.student_id = ?
            ORDER BY l.submitted_at DESC
        `).all(req.user.id);
        
        res.json({ success: true, leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取失败' });
    }
});

app.get('/api/leave/pending', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    try {
        const classes = db.prepare('SELECT class_name FROM teacher_classes WHERE teacher_id = ?').all(req.user.id);
        const classNames = classes.map(c => c.class_name);
        
        if (classNames.length === 0) {
            return res.json({ success: true, leaves: [] });
        }
        
        const placeholders = classNames.map(() => '?').join(',');
        const leaves = db.prepare(`
            SELECT l.*, s.name as student_name, s.student_no, s.class_name
            FROM leaves l
            JOIN students s ON l.student_id = s.id
            WHERE l.status = '待审批' AND s.class_name IN (${placeholders})
            ORDER BY l.submitted_at DESC
        `).all(...classNames);
        
        res.json({ success: true, leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取失败' });
    }
});

app.get('/api/leave/approved', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    try {
        const classes = db.prepare('SELECT class_name FROM teacher_classes WHERE teacher_id = ?').all(req.user.id);
        const classNames = classes.map(c => c.class_name);
        
        if (classNames.length === 0) {
            return res.json({ success: true, leaves: [] });
        }
        
        const placeholders = classNames.map(() => '?').join(',');
        const leaves = db.prepare(`
            SELECT l.*, s.name as student_name, s.student_no, s.class_name, t.name as approver_name
            FROM leaves l
            JOIN students s ON l.student_id = s.id
            LEFT JOIN teachers t ON l.approver_id = t.id
            WHERE l.status != '待审批' AND s.class_name IN (${placeholders})
            ORDER BY l.approved_at DESC
        `).all(...classNames);
        
        res.json({ success: true, leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取失败' });
    }
});

app.get('/api/leave/:id', authMiddleware, (req, res) => {
    try {
        const leave = db.prepare(`
            SELECT l.*, s.name as student_name, s.student_no, s.class_name, t.name as approver_name
            FROM leaves l
            JOIN students s ON l.student_id = s.id
            LEFT JOIN teachers t ON l.approver_id = t.id
            WHERE l.id = ?
        `).get(req.params.id);
        
        if (!leave) {
            return res.status(404).json({ success: false, message: '记录不存在' });
        }
        
        res.json({ success: true, leave });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取失败' });
    }
});

app.post('/api/leave/:id/approve', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    try {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        db.prepare(`UPDATE leaves SET status = '已批准', approver_id = ?, approved_at = ? WHERE id = ? AND status = '待审批'`).run(req.user.id, now, req.params.id);
        
        res.json({ success: true, message: '批准成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

app.post('/api/leave/:id/reject', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    const { reason } = req.body;
    if (!reason) {
        return res.status(400).json({ success: false, message: '拒绝理由不能为空' });
    }
    
    try {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        db.prepare(`UPDATE leaves SET status = '已拒绝', approver_id = ?, approved_at = ?, teacher_comment = ? WHERE id = ? AND status = '待审批'`).run(req.user.id, now, reason, req.params.id);
        
        res.json({ success: true, message: '已拒绝' });
    } catch (err) {
        res.status(500).json({ success: false, message: '操作失败' });
    }
});

app.get('/api/leave/stats/teacher', authMiddleware, (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    try {
        const classes = db.prepare('SELECT class_name FROM teacher_classes WHERE teacher_id = ?').all(req.user.id);
        const classNames = classes.map(c => c.class_name);
        
        if (classNames.length === 0) {
            return res.json({ success: true, stats: { pending: 0, approved: 0, rejected: 0 } });
        }
        
        const placeholders = classNames.map(() => '?').join(',');
        const stats = db.prepare(`
            SELECT 
                COUNT(CASE WHEN l.status = '待审批' THEN 1 END) as pending,
                COUNT(CASE WHEN l.status = '已批准' THEN 1 END) as approved,
                COUNT(CASE WHEN l.status = '已拒绝' THEN 1 END) as rejected
            FROM leaves l
            JOIN students s ON l.student_id = s.id
            WHERE s.class_name IN (${placeholders})
        `).get(...classNames);
        
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: '获取失败' });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'leave-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 jpg、png、pdf 格式'), false);
        }
    }
});

app.post('/api/upload/attachment', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: '请选择文件' });
        }
        
        res.json({
            success: true,
            message: '上传成功',
            path: `/uploads/${req.file.filename}`,
            filename: req.file.originalname
        });
    });
});

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '服务运行正常' });
});

app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
