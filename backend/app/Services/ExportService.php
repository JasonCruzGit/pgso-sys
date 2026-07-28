<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportService
{
    public function toCsv(Collection $rows, array $headers, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows, $headers) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, is_array($row) ? $row : array_values((array) $row));
            }
            fclose($handle);
        }, "{$filename}.csv", ['Content-Type' => 'text/csv']);
    }

    public function toExcel(Collection $rows, array $headers, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows, $headers) {
            echo '<?xml version="1.0" encoding="UTF-8"?>';
            echo '<?mso-application progid="Excel.Sheet"?>';
            echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">';
            echo '<Worksheet ss:Name="Sheet1" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
            echo '<Table>';
            echo '<Row>';
            foreach ($headers as $header) {
                echo '<Cell><Data ss:Type="String">'.htmlspecialchars($header).'</Data></Cell>';
            }
            echo '</Row>';
            foreach ($rows as $row) {
                echo '<Row>';
                foreach ((is_array($row) ? $row : array_values((array) $row)) as $cell) {
                    echo '<Cell><Data ss:Type="String">'.htmlspecialchars((string) $cell).'</Data></Cell>';
                }
                echo '</Row>';
            }
            echo '</Table></Worksheet></Workbook>';
        }, "{$filename}.xls", ['Content-Type' => 'application/vnd.ms-excel']);
    }

    public function toPdf(string $view, array $data, string $filename, string $paper = 'a4', string $orientation = 'portrait')
    {
        return Pdf::loadView($view, $data)
            ->setPaper($paper, $orientation)
            ->download("{$filename}.pdf");
    }
}
