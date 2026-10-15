import { useNavigate } from 'react-router';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { AddFriendModal } from '@/components/friends/AddFriendModal';
import { GroupForm } from '@/components/groups/GroupForm';
import { SettleUpForm } from '@/components/settle/SettleUpForm';
import { Modal } from '@/components/ui/Modal';
import { useWorkspace } from '@/hooks/useWorkspace';
import { attempt } from '@/lib/errors';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';

/** App-wide dialogs (add expense, settle up, new group, add friend), opened through the UI store. */
export function GlobalModals() {
  const {
    expenseModal,
    settleModal,
    groupModal,
    friendModal,
    closeModals,
    openExpense,
    openCreateGroup,
  } = useUiStore();
  const createGroup = useDataStore((s) => s.createGroup);
  const ws = useWorkspace();
  const navigate = useNavigate();
  const editing = expenseModal?.expenseId ? ws.expenses[expenseModal.expenseId] : undefined;

  return (
    <>
      <Modal
        open={!!expenseModal}
        onClose={closeModals}
        title={editing ? 'Edit expense' : 'Add an expense'}
        size="lg"
      >
        {expenseModal && (
          <ExpenseForm
            key={expenseModal.expenseId ?? 'new'}
            expense={editing}
            defaultGroupId={expenseModal.groupId}
            defaultFriendId={expenseModal.friendId}
            onCancel={closeModals}
            onDone={closeModals}
            onCreateGroup={() => openCreateGroup({ thenAddExpense: true })}
          />
        )}
      </Modal>

      <Modal open={!!settleModal} onClose={closeModals} title="Settle up">
        {settleModal && (
          <SettleUpForm
            groupId={settleModal.groupId}
            personId={settleModal.personId}
            onDone={closeModals}
            onCancel={closeModals}
          />
        )}
      </Modal>

      <Modal open={!!groupModal} onClose={closeModals} title="Create a group">
        {groupModal && (
          <GroupForm
            onCancel={closeModals}
            onSubmit={async (draft) => {
              const res = await attempt(() => createGroup(draft), `Group “${draft.name}” created`);
              if (!res.ok) return;
              if (groupModal.thenAddExpense) openExpense({ groupId: res.value });
              else {
                closeModals();
                navigate(`/groups/${res.value}`);
              }
            }}
          />
        )}
      </Modal>

      <AddFriendModal open={friendModal} onClose={closeModals} />
    </>
  );
}
