<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #006633; padding-bottom: 10px; }
        .header h1 { color: #006633; margin: 0; font-size: 16px; }
        .header p { margin: 4px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #006633; color: white; padding: 6px 4px; font-size: 9px; text-align: left; }
        td { padding: 5px 4px; border-bottom: 1px solid #ddd; font-size: 9px; }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer { margin-top: 20px; font-size: 9px; color: #888; text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Province of Palawan</h1>
        <p>PGP PGSO — Inventory Management System</p>
        <p><strong>{{ $title }}</strong></p>
    </div>
    <table>
        <thead>
            <tr>
                @foreach($headers as $header)
                    <th>{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach($rows as $row)
                <tr>
                    @foreach($row as $cell)
                        <td>{{ $cell }}</td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>
    </table>
    <div class="footer">Generated: {{ $generatedAt }}</div>
</body>
</html>
