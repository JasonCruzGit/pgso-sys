<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;

class NotificationService
{
    public function notify(User|Collection|array $users, string $type, string $title, string $message, ?array $data = null): void
    {
        $users = $users instanceof User ? collect([$users]) : collect($users);

        foreach ($users as $user) {
            Notification::create([
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
            ]);
        }
    }

    public function notifyLowStock(InventoryItem $item): void
    {
        $officers = User::query()
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['system_administrator', 'gso_inventory_officer']))
            ->where('is_active', true)
            ->get();

        $this->notify(
            $officers,
            'low_stock',
            'Low Stock Alert',
            "{$item->name} ({$item->item_code}) has reached reorder level. Current: {$item->quantity}, Reorder: {$item->reorder_level}",
            ['inventory_item_id' => $item->id],
        );
    }

    public function notifyPendingApproval(int $requestId, string $requestNumber): void
    {
        $officers = $this->inventoryOfficers();

        $this->notify(
            $officers,
            'pending_approval',
            'Request Pending Approval',
            "Issuance request {$requestNumber} is pending approval.",
            ['issuance_request_id' => $requestId],
        );
    }

    public function notifyRequestSubmitted(User $requester, int $requestId, string $requestNumber): void
    {
        $this->notify(
            $requester,
            'request_submitted',
            'Request Submitted',
            "Your issuance request {$requestNumber} has been submitted and is awaiting approval.",
            ['issuance_request_id' => $requestId],
        );
    }

    public function notifyRequestApproved(User $requester, int $requestId, string $requestNumber): void
    {
        $this->notify(
            $requester,
            'request_approved',
            'Request Approved',
            "Your issuance request {$requestNumber} has been approved and is ready for release.",
            ['issuance_request_id' => $requestId],
        );
    }

    public function notifyRequestRejected(User $requester, int $requestId, string $requestNumber, string $reason): void
    {
        $this->notify(
            $requester,
            'request_rejected',
            'Request Rejected',
            "Your issuance request {$requestNumber} was rejected. Reason: {$reason}",
            ['issuance_request_id' => $requestId],
        );
    }

    public function notifyRequestReleased(User $requester, int $requestId, string $requestNumber): void
    {
        $this->notify(
            $requester,
            'request_released',
            'Items Released',
            "Items for request {$requestNumber} have been released from inventory.",
            ['issuance_request_id' => $requestId],
        );
    }

    public function notifyStockTransaction(string $type, string $transactionNumber, string $itemName, float $quantity, string $unit): void
    {
        $label = $type === 'stock_in' ? 'Stock Received' : 'Stock Issued';
        $action = $type === 'stock_in' ? 'received into' : 'released from';

        $this->notify(
            $this->inventoryOfficers(),
            $type,
            $label,
            "{$quantity} {$unit} of {$itemName} {$action} inventory ({$transactionNumber}).",
            ['transaction_number' => $transactionNumber],
        );
    }

    public function notifyAccountRegistrationPending(User $user): void
    {
        $this->notify(
            $this->administrators(),
            'account_registration',
            'New Account Registration',
            "{$user->name} ({$user->email}) requested access and is awaiting approval.",
            ['user_id' => $user->id],
        );
    }

    public function notifyAccountApproved(User $user): void
    {
        $this->notify(
            $user,
            'account_approved',
            'Account Approved',
            'Your account has been approved. You can now sign in to the system.',
            [],
        );
    }

    public function notifyAccountRejected(User $user): void
    {
        $this->notify(
            $user,
            'account_rejected',
            'Account Not Approved',
            'Your registration request was not approved. Contact GSO IT for assistance.',
            [],
        );
    }

    private function administrators()
    {
        return User::query()
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['system_administrator', 'gso_inventory_officer']))
            ->where('is_active', true)
            ->get();
    }

    private function inventoryOfficers()
    {
        return User::query()
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['system_administrator', 'gso_inventory_officer']))
            ->where('is_active', true)
            ->get();
    }
}
