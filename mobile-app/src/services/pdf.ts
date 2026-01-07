/**
 * PDF Export Service
 * Generates PDF reports from INR readings
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { INRReading, Settings } from '../types';

export async function generateAndSharePDF(
  readings: INRReading[],
  settings: Settings
): Promise<void> {
  const html = generateReportHTML(readings, settings);

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Share PDF
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share INR Report',
      UTI: 'com.adobe.pdf',
    });
  }
}

function generateReportHTML(readings: INRReading[], settings: Settings): string {
  const sortedReadings = [...readings].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  );

  // Calculate stats
  const inrValues = readings.map(r => r.inr).filter(v => v > 0);
  const avgINR = inrValues.length > 0
    ? (inrValues.reduce((a, b) => a + b, 0) / inrValues.length).toFixed(2)
    : '--';

  const inRangeCount = readings.filter(
    r => r.inr >= settings.targetRangeMin && r.inr <= settings.targetRangeMax
  ).length;
  const ttr = readings.length > 0
    ? Math.round((inRangeCount / readings.length) * 100)
    : 0;

  const dateRange = readings.length > 0
    ? `${formatDate(readings[0].timestamp)} - ${formatDate(readings[readings.length - 1].timestamp)}`
    : '--';

  const getColor = (inr: number) => {
    if (inr >= settings.targetRangeMin && inr <= settings.targetRangeMax) {
      return '#22c55e'; // green
    } else if (inr < settings.targetRangeMin - 0.3 || inr > settings.targetRangeMax + 0.3) {
      return '#ef4444'; // red
    }
    return '#f59e0b'; // yellow
  };

  const readingsRows = sortedReadings.map(r => `
    <tr>
      <td>${formatDate(r.timestamp)}</td>
      <td>${formatTime(r.timestamp)}</td>
      <td style="color: ${getColor(r.inr)}; font-weight: 600;">${r.inr.toFixed(1)}</td>
      <td>${r.pt_seconds.toFixed(1)}</td>
      <td>${r.status}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>INR/PT Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #1f2937;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 {
      font-size: 24px;
      color: #111827;
      margin-bottom: 8px;
    }
    .header p {
      color: #6b7280;
      font-size: 14px;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #3b82f6;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #f3f4f6;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
    .disclaimer {
      margin-top: 20px;
      padding: 15px;
      background: #fef3c7;
      border-radius: 8px;
      font-size: 11px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INR/PT Test Report</h1>
    <p>Generated on ${new Date().toLocaleDateString()} • Coag-Sense PT/INR System</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${readings.length}</div>
      <div class="stat-label">Total Readings</div>
    </div>
    <div class="stat">
      <div class="stat-value">${avgINR}</div>
      <div class="stat-label">Average INR</div>
    </div>
    <div class="stat">
      <div class="stat-value">${settings.targetRangeMin}-${settings.targetRangeMax}</div>
      <div class="stat-label">Target Range</div>
    </div>
    <div class="stat">
      <div class="stat-value">${ttr}%</div>
      <div class="stat-label">Time in Range</div>
    </div>
  </div>

  <h3>All Readings</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>INR</th>
        <th>PT (sec)</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${readingsRows}
    </tbody>
  </table>

  <div class="disclaimer">
    This report is for informational purposes only. Always consult your healthcare provider for medical advice regarding your anticoagulation therapy.
  </div>

  <div class="footer">
    Generated by Coag-Sense Tracker App
  </div>
</body>
</html>
  `;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
