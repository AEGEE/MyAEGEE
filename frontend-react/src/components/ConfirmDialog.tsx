// "Are you sure?" before destructive or important actions. An alertdialog (React Aria
// Components) that traps focus, starts on Cancel (the safe choice), closes on Escape and
// returns focus to the button that opened it. Replaces Buefy's $buefy.dialog.confirm(), which renders its message as HTML.
import type { ReactNode } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import styles from '../styles/dialog.module.css';

export interface ConfirmRequest {
    title: string;
    message: ReactNode;
    confirmText: string;
    tone?: 'danger' | 'primary';
    onConfirm: () => void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
    return (
        <ModalOverlay className={styles.overlay} isDismissable isOpen={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <Modal className={styles.modal}>
                <Dialog role="alertdialog" className={styles.dialog}>
                    {({ close }) => request && (
                        <>
                            <Heading slot="title" className={styles.title}>{request.title}</Heading>
                            <div className={styles.body}>{request.message}</div>
                            <div className={styles.actions}>
                                <Button className="button" onPress={close}>Cancel</Button>
                                <Button
                                    className={`button ${request.tone ?? 'primary'}`}
                                    onPress={() => { close(); request.onConfirm(); }}
                                >
                                    {request.confirmText}
                                </Button>
                            </div>
                        </>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
