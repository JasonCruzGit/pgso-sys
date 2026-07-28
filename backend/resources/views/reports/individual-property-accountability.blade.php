<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Individual Property Accountability</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1e293b; margin: 24px; }
        h1 { font-size: 15px; color: #166534; margin: 0 0 2px; text-transform: uppercase; }
        .subtitle { font-size: 10px; color: #64748b; margin-bottom: 14px; }
        .republic { font-size: 9px; text-transform: uppercase; margin: 0; }
        .province { font-size: 11px; font-weight: bold; margin: 2px 0 0; text-transform: uppercase; }
        .office { font-size: 10px; font-weight: bold; color: #166534; margin: 2px 0 0; text-transform: uppercase; }
        .meta { font-size: 9px; color: #64748b; margin-bottom: 12px; }
        .employee-grid { width: 100%; margin-bottom: 12px; border-collapse: separate; border-spacing: 8px 0; }
        .employee-grid td {
            width: 25%;
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            padding: 8px 10px;
            vertical-align: top;
        }
        .label { display: block; font-size: 8px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
        .value { font-size: 10px; font-weight: bold; color: #0f172a; }
        .summary { margin-bottom: 12px; font-size: 9px; }
        .summary span { margin-right: 12px; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th {
            background: #166534;
            color: white;
            padding: 6px 5px;
            text-align: left;
            font-size: 8px;
            text-transform: uppercase;
        }
        table.data td {
            border: 1px solid #cbd5e1;
            padding: 5px;
            vertical-align: top;
            font-size: 9px;
        }
        table.data tr:nth-child(even) td { background: #f8fafc; }
        .num { text-align: right; }
        .center { text-align: center; }
        .mono { font-family: DejaVu Sans Mono, monospace; font-size: 8px; }
        .footer { margin-top: 16px; font-size: 8px; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
    <p class="republic">{{ $republic }}</p>
    <p class="province">{{ $province }}</p>
    <p class="office">{{ $office }}</p>

    <h1>Individual Property Accountability</h1>
    <p class="subtitle">Property records assigned to employee</p>
    <div class="meta">
        Generated: {{ $generatedAt }} &nbsp;|&nbsp; View: {{ $viewLabel }}
    </div>

    <table class="employee-grid">
        <tr>
            <td>
                <span class="label">Employee No.</span>
                <span class="value mono">{{ $employee['employee_id'] ?? '—' }}</span>
            </td>
            <td>
                <span class="label">Employee Name</span>
                <span class="value">{{ $employee['name'] }}</span>
            </td>
            <td>
                <span class="label">Designation</span>
                <span class="value">{{ $employee['designation'] ?? '—' }}</span>
            </td>
            <td>
                <span class="label">Department</span>
                <span class="value">{{ $employee['department'] ?? '—' }}</span>
            </td>
        </tr>
    </table>

    <div class="summary">
        <span><strong>{{ $summary['total'] }}</strong> total</span>
        <span><strong>{{ $summary['active'] }}</strong> active</span>
        <span><strong>{{ $summary['surrendered'] }}</strong> surrendered</span>
        <span><strong>₱{{ number_format($summary['total_value'], 2) }}</strong> total value</span>
    </div>

    <table class="data">
        <thead>
            <tr>
                <th>Property No.</th>
                <th>Reference No.</th>
                <th>Type</th>
                <th>Description</th>
                <th>Date Acquired</th>
                <th class="num">Qty</th>
                <th>Unit</th>
                <th class="num">Unit Value</th>
                <th class="num">Total Value</th>
                <th class="center">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse($properties as $row)
                <tr>
                    <td class="mono">{{ $row['property_number'] }}</td>
                    <td class="mono">{{ $row['reference_number'] }}</td>
                    <td class="center">{{ $row['document_type'] }}</td>
                    <td>{{ $row['description'] }}</td>
                    <td>{{ $row['date_acquired'] ?? '—' }}</td>
                    <td class="num">{{ $row['quantity'] }}</td>
                    <td>{{ $row['unit_of_measure'] }}</td>
                    <td class="num">₱{{ number_format($row['unit_value'], 2) }}</td>
                    <td class="num">₱{{ number_format($row['total_value'], 2) }}</td>
                    <td class="center">{{ ucfirst(str_replace('_', ' ', $row['status'])) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="10" class="center">No property records.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">{{ $footer }}</div>
</body>
</html>
