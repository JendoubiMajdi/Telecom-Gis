import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  searchSitesHandler,
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateStatusHandler,
  addCommentHandler,
  reassignHandler,
  deleteTaskHandler,
} from '../controllers/task.controller';

const router = Router();

// Tasks are for staff only: admins manage them, operators work on their own.
// Viewers have no access.
router.use(authenticate);

router.get('/sites', requireRole('admin'), searchSitesHandler);     // keep above '/:id'
router.get('/', requireRole('admin', 'operator'), listTasksHandler);
router.post('/', requireRole('admin'), createTaskHandler);
router.get('/:id', requireRole('admin', 'operator'), getTaskHandler);
router.patch('/:id/status', requireRole('admin', 'operator'), updateStatusHandler);
router.post('/:id/comments', requireRole('admin', 'operator'), addCommentHandler);
router.patch('/:id/assignee', requireRole('admin'), reassignHandler);
router.delete('/:id', requireRole('admin'), deleteTaskHandler);

export default router;