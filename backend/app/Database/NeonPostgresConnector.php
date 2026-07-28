<?php

namespace App\Database;

use Illuminate\Database\Connectors\PostgresConnector;

/**
 * Neon on Vercel PHP needs endpoint ID in the DSN (libpq without SNI).
 */
class NeonPostgresConnector extends PostgresConnector
{
    protected function getDsn(array $config): string
    {
        $dsn = parent::getDsn($config);

        if (! empty($config['endpoint_id'])) {
            $endpoint = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $config['endpoint_id']);
            $dsn .= ";options=endpoint={$endpoint}";
        }

        return $dsn;
    }
}
