<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daily Report</title>
    <style>
        @page { margin: 18px 22px; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 9.5px;
            color: #0f172a;
            margin: 0;
        }

        .letterhead {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
        }
        .letterhead td {
            vertical-align: middle;
            padding: 0;
        }
        .letterhead .logo {
            width: 78px;
            text-align: center;
            background: #ffffff;
            border: none;
        }
        .letterhead .logo img {
            width: 68px;
            height: 68px;
            object-fit: contain;
            background: #ffffff;
            border: none;
        }
        .letterhead .center {
            text-align: center;
            padding: 0 10px;
        }
        .republic {
            font-size: 9px;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            margin: 0;
            color: #334155;
        }
        .province {
            font-size: 13px;
            font-weight: bold;
            margin: 3px 0 0;
            text-transform: uppercase;
            color: #0f172a;
        }
        .office {
            font-size: 11.5px;
            font-weight: bold;
            color: #006633;
            margin: 3px 0 0;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .city {
            font-size: 9px;
            margin: 2px 0 0;
            color: #475569;
        }

        .rule {
            border: none;
            border-top: 2.5px solid #006633;
            margin: 8px 0 4px;
        }
        .rule-thin {
            border: none;
            border-top: 1px solid #86efac;
            margin: 0 0 12px;
        }

        .title-block {
            text-align: center;
            margin: 0 0 12px;
        }
        .title-block h1 {
            margin: 0;
            font-size: 20px;
            letter-spacing: 1px;
            color: #0f172a;
        }
        .title-block .subtitle {
            margin: 3px 0 0;
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        .meta-bar {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .meta-bar td {
            width: 50%;
            background: #ecfdf3;
            border: 1px solid #bbf7d0;
            padding: 8px 10px;
            vertical-align: middle;
        }
        .meta-bar .right { text-align: right; }
        .meta-label {
            display: inline-block;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #166534;
            margin-right: 6px;
        }
        .meta-value {
            font-size: 10.5px;
            font-weight: bold;
            color: #0f172a;
        }
        .mode-pill {
            display: inline-block;
            background: #006633;
            color: #fff;
            padding: 3px 10px;
            font-size: 9px;
            font-weight: bold;
            letter-spacing: 0.6px;
            text-transform: uppercase;
        }

        table.data {
            width: 100%;
            border-collapse: collapse;
        }
        table.data thead th {
            background: #006633;
            color: #ffffff;
            border: 1px solid #004d27;
            padding: 7px 6px;
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            text-align: left;
        }
        table.data tbody td {
            border: 1px solid #cbd5e1;
            padding: 7px 6px;
            vertical-align: top;
            font-size: 8.5px;
            color: #1e293b;
            line-height: 1.35;
        }
        table.data tbody tr:nth-child(even) td {
            background: #f8fafc;
        }
        table.data tbody tr:nth-child(odd) td {
            background: #ffffff;
        }

        .num { width: 28px; text-align: center; color: #64748b; }
        .ctrl {
            width: 88px;
            font-family: DejaVu Sans Mono, monospace;
            font-size: 8px;
            font-weight: bold;
            color: #006633;
            white-space: nowrap;
        }
        .origin { width: 120px; }
        .particular { width: auto; }
        .admin, .enduser { width: 95px; color: #334155; }

        .empty {
            text-align: center;
            padding: 22px !important;
            color: #64748b;
            font-style: italic;
        }

        .footer {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 1.5px solid #006633;
            font-size: 8px;
            color: #64748b;
        }
        .footer-table {
            width: 100%;
            border-collapse: collapse;
        }
        .footer-table td { padding: 0; vertical-align: middle; }
        .footer-table .right { text-align: right; }
        .count-badge {
            display: inline-block;
            background: #ecfdf3;
            border: 1px solid #bbf7d0;
            color: #166534;
            padding: 2px 8px;
            font-weight: bold;
            font-size: 8px;
        }
    </style>
</head>
<body>
    <table class="letterhead">
        <tr>
            <td class="logo">
                @if(!empty($pgpLogo))
                    <img src="{{ $pgpLogo }}" alt="PGP Seal" />
                @endif
            </td>
            <td class="center">
                <p class="republic">{{ $republic }}</p>
                <p class="province">{{ $province }}</p>
                <p class="office">{{ $office }}</p>
                <p class="city">{{ $city }}</p>
            </td>
            <td class="logo">
                @if(!empty($pgsoLogo))
                    <img src="{{ $pgsoLogo }}" alt="PGSO Seal" />
                @endif
            </td>
        </tr>
    </table>

    <hr class="rule" />
    <hr class="rule-thin" />

    <div class="title-block">
        <h1>Daily Report</h1>
        <p class="subtitle">Document Tracking &amp; Records</p>
    </div>

    <table class="meta-bar">
        <tr>
            <td>
                <span class="meta-label">Date</span>
                <span class="meta-value">{{ $dateLabel }}</span>
            </td>
            <td class="right">
                <span class="meta-label">Selected Mode</span>
                <span class="mode-pill">{{ $mode }}</span>
            </td>
        </tr>
    </table>

    <table class="data">
        <thead>
            <tr>
                <th class="num">#</th>
                <th class="ctrl">Control No</th>
                <th class="origin">Origin</th>
                <th class="particular">Particular</th>
                <th class="admin">Admin</th>
                <th class="enduser">End-User</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $index => $row)
                <tr>
                    <td class="num">{{ $index + 1 }}</td>
                    <td class="ctrl">{{ $row['control_no'] }}</td>
                    <td class="origin">{{ $row['origin'] }}</td>
                    <td class="particular">{{ $row['particular'] }}</td>
                    <td class="admin">{{ $row['admin'] !== '' ? $row['admin'] : '—' }}</td>
                    <td class="enduser">{{ $row['end_user'] !== '' ? $row['end_user'] : '—' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="empty">No documents for this report.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        <table class="footer-table">
            <tr>
                <td>{{ $footer }}</td>
                <td class="right">
                    <span class="count-badge">{{ count($rows) }} record(s)</span>
                    &nbsp;&nbsp;Generated: {{ $generatedAt }}
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
