<?php

namespace App\Traits;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait GeneratesReference
{
    protected function generateReference(string $prefix, string $table, string $column): string
    {
        do {
            $ref = $prefix.now()->format('Ymd').'-'.strtoupper(Str::random(4));
        } while (DB::table($table)->where($column, $ref)->exists());

        return $ref;
    }
}
