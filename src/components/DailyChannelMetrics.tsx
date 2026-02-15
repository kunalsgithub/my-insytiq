import React, { useRef } from 'react';
import AnimatedList from './AnimatedList';
import './AnimatedList.css';
import './DailyChannelMetrics.css';
import { Download } from 'lucide-react';

function formatNumber(num: number | string) {
  if (num === undefined || num === null || num === '') return '--';
  return Number(num).toLocaleString();
}

const DailyChannelMetrics = ({ metrics }: { metrics: any[] }) => {
  console.log("DailyChannelMetrics metrics.length:", metrics.length);
  const renderMetricRow = (row: any, i: number, isSelected: boolean) => {
    // Format date
    let day = '';
    let dateStr = '';
    if (row.date instanceof Date) {
      day = row.date.toLocaleDateString('en-US', { weekday: 'short' });
      dateStr = row.date.toISOString().slice(0, 10);
    } else if (typeof row.date === 'string') {
      const d = new Date(row.date);
      day = d.toLocaleDateString('en-US', { weekday: 'short' });
      dateStr = row.date;
    }
    // Color helpers
    const pos = '#16a34a';
    const neg = '#dc2626';
    const neu = '#334155';
    // Render: always horizontal row
    return (
      <div
        className={`flex items-center justify-between bg-white border border-gray-200 rounded-xl shadow-sm px-2 py-1 mb-2 transition-all ${isSelected ? 'ring-2 ring-insta-primary' : ''}`}
      >
        <div className="w-[7%] font-medium text-gray-700">{day}</div>
        <div className="w-[13%] text-center text-gray-700">{dateStr}</div>
        <div className="w-[10%] text-center font-semibold" style={{ color: row.followersChange > 0 ? pos : row.followersChange < 0 ? neg : neu }}>
          {row.followersChange > 0 ? `+${formatNumber(row.followersChange)}` : row.followersChange < 0 ? formatNumber(row.followersChange) : '--'}
        </div>
        <div className="w-[13%] text-center text-gray-700">{formatNumber(row.followersTotal)}</div>
        <div className="w-[10%] text-center font-semibold" style={{ color: row.followingChange > 0 ? pos : row.followingChange < 0 ? neg : '#64748b' }}>
          {row.followingChange > 0 ? `+${row.followingChange}` : row.followingChange < 0 ? row.followingChange : '--'}
        </div>
        <div className="w-[13%] text-center text-gray-700">{formatNumber(row.followingTotal)}</div>
        <div className="w-[10%] text-center font-semibold" style={{ color: row.mediaChange > 0 ? pos : row.mediaChange < 0 ? neg : '#64748b' }}>
          {row.mediaChange > 0 ? `+${row.mediaChange}` : row.mediaChange < 0 ? row.mediaChange : '--'}
        </div>
        <div className="w-[13%] text-center text-gray-700">{formatNumber(row.mediaTotal)}</div>
      </div>
    );
  };

  // CSV download logic
  function downloadCSV() {
    if (!metrics.length) return;
    const headers = [
      'Day', 'Date', 'Followers', 'Followers Total', 'Following', 'Following Total', 'Media', 'Media Total'
    ];
    const rows = metrics.map(row => {
      let day = '';
      let dateStr = '';
      if (row.date instanceof Date) {
        day = row.date.toLocaleDateString('en-US', { weekday: 'short' });
        dateStr = row.date.toISOString().slice(0, 10);
      } else if (typeof row.date === 'string') {
        const d = new Date(row.date);
        day = d.toLocaleDateString('en-US', { weekday: 'short' });
        dateStr = row.date;
      }
      return [
        day,
        dateStr,
        row.followersChange,
        row.followersTotal,
        row.followingChange,
        row.followingTotal,
        row.mediaChange,
        row.mediaTotal
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily_channel_metrics.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
  <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">Daily Channel Metrics</h3>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1 px-2 py-1 border border-blue-500 text-blue-600 font-semibold text-xs rounded hover:bg-blue-50 transition-colors min-w-0"
        >
          <Download className="w-3 h-3 mr-1" />
          Download as CSV
        </button>
      </div>
      <div className="bg-gray-50 rounded-2xl p-2">
        <div className="overflow-x-auto">
          <div className="daily-metrics-container">
            <div className="metrics-min-width" style={{ minWidth: 800, fontSize: '13px' }}>
              <div className="flex items-center justify-between px-2 py-1 mb-2 rounded-xl" style={{ background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)', color: 'white', fontWeight: 600, fontSize: '13px' }}>
                <div className="w-[7%]">Day</div>
                <div className="w-[13%] text-center">Date</div>
                <div className="w-[10%] text-center">Followers</div>
                <div className="w-[13%] text-center">Followers Total</div>
                <div className="w-[10%] text-center">Following</div>
                <div className="w-[13%] text-center">Following Total</div>
                <div className="w-[10%] text-center">Media</div>
                <div className="w-[13%] text-center">Media Total</div>
              </div>
              <AnimatedList
                items={metrics}
                renderItem={(row, i, isSelected) => renderMetricRow(row, i, isSelected)}
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
  </div>
);
};

export default DailyChannelMetrics; 