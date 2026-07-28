<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vehicle Borrower's Slip — {{ $slip->slip_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1e293b; margin: 24px; }
        h1 { font-size: 16px; color: #166534; margin: 0 0 4px; text-align: center; text-transform: uppercase; }
        .subtitle { text-align: center; font-size: 10px; color: #64748b; margin-bottom: 18px; }
        .meta { margin-bottom: 14px; font-size: 11px; }
        .meta strong { color: #166534; }
        table.fields { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        table.fields th, table.fields td { border: 1px solid #cbd5e1; padding: 7px 9px; vertical-align: top; }
        table.fields th { width: 32%; background: #f1f5f9; text-align: left; font-weight: 600; color: #334155; }
        .sig-row { width: 100%; margin-top: 36px; }
        .sig-col { width: 45%; display: inline-block; vertical-align: top; }
        .sig-line { border-bottom: 1px solid #111; height: 28px; margin-bottom: 4px; }
        .sig-label { text-align: center; font-size: 10px; text-transform: uppercase; color: #64748b; }
        .footer { margin-top: 28px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    </style>
</head>
<body>
    <h1>Vehicle Borrower's Slip</h1>
    <p class="subtitle">Provincial General Services Office — Fleet Management</p>

    <div class="meta">
        <strong>Slip No.:</strong> {{ $slip->slip_number }}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Date filed:</strong> {{ $slip->created_at?->timezone('Asia/Manila')->format('M d, Y h:i A') }}
    </div>

    <table class="fields">
        <tr>
            <th>Borrower Name</th>
            <td>{{ $slip->borrower_name }}</td>
        </tr>
        <tr>
            <th>Office / Department</th>
            <td>{{ $slip->department?->name ?? '—' }}</td>
        </tr>
        <tr>
            <th>Contact No.</th>
            <td>{{ $slip->contact_no ?: '—' }}</td>
        </tr>
        <tr>
            <th>Purpose</th>
            <td>{{ $slip->purpose }}</td>
        </tr>
        <tr>
            <th>Destination</th>
            <td>{{ $slip->destination }}</td>
        </tr>
        <tr>
            <th>Departure</th>
            <td>{{ $slip->departure_at?->timezone('Asia/Manila')->format('M d, Y h:i A') }}</td>
        </tr>
        <tr>
            <th>Expected Return</th>
            <td>{{ $slip->expected_return_at?->timezone('Asia/Manila')->format('M d, Y h:i A') }}</td>
        </tr>
        <tr>
            <th>Passengers</th>
            <td>{{ $slip->passengers }}</td>
        </tr>
        <tr>
            <th>Requested Vehicle Type</th>
            <td>{{ $slip->requested_vehicle_type ? strtoupper($slip->requested_vehicle_type) : 'Any' }}</td>
        </tr>
        <tr>
            <th>Driver Needed</th>
            <td>
                {{ $slip->driver_needed ? 'Yes' : 'No' }}
                @if($slip->preferred_driver_note)
                    — {{ $slip->preferred_driver_note }}
                @endif
            </td>
        </tr>
        <tr>
            <th>Remarks</th>
            <td>{{ $slip->remarks ?: '—' }}</td>
        </tr>
    </table>

    <div class="sig-row">
        <div class="sig-col" style="margin-right: 8%;">
            <div class="sig-line"></div>
            <p class="sig-label">Borrower Signature</p>
        </div>
        <div class="sig-col">
            <div class="sig-line"></div>
            <p class="sig-label">Authorized / Approving Officer</p>
        </div>
    </div>

    <p class="footer">Generated {{ $generatedAt }} · INV-PGP-GSO Fleet Management</p>
</body>
</html>
