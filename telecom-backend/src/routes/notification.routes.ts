import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
} from '../controllers/notification.controller';

const router = Router();

// Any logged-in user can read THEIR OWN notifications.
router.use(authenticate);

router.get('/', listNotificationsHandler);
router.patch('/read-all', markAllReadHandler);   // must stay above '/:id/read'
router.patch('/:id/read', markReadHandler);

export default router;