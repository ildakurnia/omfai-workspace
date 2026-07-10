<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Aktivitas OMFAI Workspace</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11px;
            color: #333333;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }
        .header {
            border-bottom: 3px solid #FF8200;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header table {
            width: 100%;
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a1a;
            margin: 0;
        }
        .subtitle {
            font-size: 11px;
            color: #666666;
            margin-top: 5px;
        }
        .info-table {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .info-table td {
            padding: 4px 0;
        }
        .info-label {
            font-weight: bold;
            width: 100px;
            color: #666666;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .data-table th {
            background-color: #f7f7f8;
            border-bottom: 2px solid #e2e8f0;
            color: #1a1a1a;
            font-weight: bold;
            text-align: left;
            padding: 8px 6px;
        }
        .data-table td {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 6px;
            vertical-align: top;
        }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-in_progress {
            background-color: #ebf8ff;
            color: #2b6cb0;
        }
        .badge-on_hold {
            background-color: #fffaf0;
            color: #dd6b20;
        }
        .badge-done {
            background-color: #f0fff4;
            color: #38a169;
        }
        .link {
            color: #FF8200;
            text-decoration: none;
            word-break: break-all;
        }
        .footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 9px;
            color: #999999;
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <table>
            <tr>
                <td>
                    <div class="title">OMFAI Workspace</div>
                    <div class="subtitle">Sistem Pemantauan Aktivitas Karyawan Terpusat</div>
                </td>
                <td style="text-align: right; font-size: 14px; font-weight: bold; color: #FF8200;">
                    LAPORAN AKTIVITAS
                </td>
            </tr>
        </table>
    </div>

    <table class="info-table">
        <tr>
            <td class="info-label">Periode</td>
            <td>: {{ $period }}</td>
            <td class="info-label" style="text-align: right;">Dicetak Pada</td>
            <td style="text-align: right;">: {{ \Carbon\Carbon::now('Asia/Jakarta')->format('d M Y H:i') }} WIB</td>
        </tr>
    </table>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 15%;">Karyawan</th>
                <th style="width: 12%;">Tanggal</th>
                <th style="width: 15%;">Kategori</th>
                <th style="width: 28%;">Aktivitas / Pekerjaan</th>
                <th style="width: 10%;">Status</th>
                <th style="width: 20%;">Detail Hold / Link Bukti</th>
            </tr>
        </thead>
        <tbody>
            @forelse($activities as $activity)
                <tr>
                    <td><strong>{{ $activity->user->name }}</strong></td>
                    <td>{{ $activity->created_at->timezone('Asia/Jakarta')->format('d M Y') }}<br><span style="color: #888; font-size: 9px;">{{ $activity->created_at->timezone('Asia/Jakarta')->format('H:i') }} WIB</span></td>
                    <td>{{ $activity->category->name }}</td>
                    <td>
                        <strong>{{ $activity->activity }}</strong>
                        @if($activity->progress_note)
                            <div style="color: #555555; font-size: 9px; margin-top: 4px; font-style: italic; font-weight: normal;">
                                Progress: {{ $activity->progress_note }}
                            </div>
                        @endif
                    </td>
                    <td>
                        <span class="badge badge-{{ $activity->status->value }}">
                            {{ $activity->status->value == 'in_progress' ? 'In Progress' : ($activity->status->value == 'on_hold' ? 'On Hold' : 'Done') }}
                        </span>
                        @if(!empty($activity->overtime_duration_formatted))
                            <div style="color: #FF8200; font-size: 8.5px; margin-top: 5px; font-weight: bold;">
                                🌙 Time Log:<br>{{ $activity->overtime_duration_formatted }}
                            </div>
                        @endif
                    </td>
                    <td>
                        @if($activity->status->value == 'on_hold' && $activity->hold_reason)
                            <strong>Kendala:</strong> {{ str_replace('Lembur', 'Time Log', $activity->hold_reason) }}
                        @endif

                        @if($activity->reference_link)
                            @if($activity->status->value == 'on_hold' && $activity->hold_reason)
                                <br><br>
                            @endif
                            <strong>Bukti:</strong> <a class="link" href="{{ $activity->reference_link }}" target="_blank">Buka Link</a>
                        @endif

                        @if(!$activity->hold_reason && !$activity->reference_link)
                            -
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #666666;">
                        Tidak ada data aktivitas yang ditemukan pada periode ini.
                    </td>
                </tr>
            @endforelse
            @if(isset($is_overtime_only) && $is_overtime_only && count($activities) > 0)
                <tr style="background-color: #fffaf0; font-weight: bold;">
                    <td colspan="4" style="text-align: right; padding: 10px; border-top: 2px solid #FF8200; border-bottom: 2px solid #FF8200;">Total Seluruh Time Log:</td>
                    <td colspan="2" style="color: #FF8200; padding: 10px; border-top: 2px solid #FF8200; border-bottom: 2px solid #FF8200; font-size: 12px;">{{ $total_overtime_formatted }}</td>
                </tr>
            @endif
        </tbody>
    </table>

    <div class="footer">
        Dokumen ini dihasilkan secara otomatis oleh OMFAI Workspace. &copy; {{ date('Y') }} OMFAI.
    </div>
</body>
</html>
