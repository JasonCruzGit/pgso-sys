<?php

namespace App\Enums;

enum DocumentTaskDivision: string
{
    case All = 'all';
    case IncomingOutgoing = 'incoming_outgoing';
    case Incoming = 'incoming';
    case Outgoing = 'outgoing';
    case Routing = 'routing';
    case Records = 'records';

    public function label(): string
    {
        return match ($this) {
            self::All => 'All documents (full access)',
            self::IncomingOutgoing => 'Incoming & Outgoing only',
            self::Incoming => 'Incoming documents only',
            self::Outgoing => 'Outgoing documents only',
            self::Routing => 'Document routing / forwarding',
            self::Records => 'Document records & filing',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::All => 'Receive, release, route, and manage all tracked documents.',
            self::IncomingOutgoing => 'Handle receipt of incoming and release of outgoing documents only.',
            self::Incoming => 'Responsible only for receiving and logging incoming documents.',
            self::Outgoing => 'Responsible only for releasing and logging outgoing documents.',
            self::Routing => 'Responsible for routing documents between offices.',
            self::Records => 'Responsible for filing, archiving, and document record-keeping.',
        };
    }

    /**
     * @return list<string>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::All => [
                'documents.view', 'documents.*',
            ],
            self::IncomingOutgoing => [
                'documents.view', 'documents.incoming', 'documents.outgoing',
            ],
            self::Incoming => [
                'documents.view', 'documents.incoming',
            ],
            self::Outgoing => [
                'documents.view', 'documents.outgoing',
            ],
            self::Routing => [
                'documents.view', 'documents.routing',
            ],
            self::Records => [
                'documents.view', 'documents.records',
            ],
        };
    }

    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $case) => [
                'value' => $case->value,
                'label' => $case->label(),
                'description' => $case->description(),
            ],
            self::cases(),
        );
    }
}
