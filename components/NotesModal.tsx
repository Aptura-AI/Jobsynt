import { useEffect, useState } from 'react';
import Modal from './Modal';
import Textarea from './Textarea';
import Button from './Button';

type Props = {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => void;
};

export default function NotesModal({ open, initial, onClose, onSave }: Props) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, open]);

  return (
    <Modal open={open} title="Internal notes" onClose={onClose}>
      <Textarea rows={5} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="mt-4 flex justify-end">
        <Button onClick={() => onSave(value)}>Save</Button>
      </div>
    </Modal>
  );
}

