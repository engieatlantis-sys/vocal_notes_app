export interface Note {
  id: string;
  title: string;
  content: string;
  category: 'rdv' | 'tache' | 'intervention';
  hasNotification: boolean;
  notificationDate?: string;
  createdAt: string;
  updatedAt: string;
  completed?: boolean;
  priority?: string;
}

export type NewNote = {
  title: string;
  content: string;
  category: 'rdv' | 'tache' | 'intervention';
  hasNotification: boolean;
  notificationDate?: string;
};

export default {};
