import React, { useRef, useEffect } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { prepareChartData, formatChartNumber } from '@/utils/chartDataProcessor';

export interface SocialBladeChartProps {
  id: string;
  data: Array<{ date: string | Date; [key: string]: any }>;
  valueField?: string;
  dateField?: string;
  interval?: 'day' | 'month';
  height?: string;
  color?: string;
  showArea?: boolean;
  showBullets?: boolean;
  className?: string;
}

const SocialBladeChart: React.FC<SocialBladeChartProps> = ({
  id,
  data,
  valueField = 'value',
  dateField = 'date',
  interval = 'day',
  height = '400px',
  color,
  showArea = true,
  showBullets = true,
  className = '',
}) => {
  const chartRef = useRef<am5.Root | null>(null);


  useEffect(() => {
    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }

    if (!data || data.length === 0) {
      return;
    }

    // Prepare data
    const prepared = prepareChartData(data, valueField, dateField);
    
    if (prepared.length === 0) {
      return;
    }

    // Create root
    const root = am5.Root.new(id);
    chartRef.current = root;

    root.setThemes([am5themes_Animated.new(root)]);

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        layout: root.verticalLayout,
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    // Create date axis
    // For monthly data spanning multiple years, configure to show all data
    const dateInterval = interval === 'month' ? { timeUnit: "month", count: 1 } : { timeUnit: interval, count: 1 };
    
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: dateInterval,
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 60,
          minorGridEnabled: true,
        }),
        tooltip: am5.Tooltip.new(root, {}),
        // Don't group data - show all monthly points across all years
        groupData: false,
      })
    );
    
    // Configure date formats after axis creation (for monthly charts)
    if (interval === 'month') {
      // Use label adapter to format dates for monthly charts
      xAxis.get("renderer").labels.template.adapters.add("text", (text, target) => {
        if (target.dataItem && target.dataItem.get("valueX")) {
          const date = new Date(target.dataItem.get("valueX"));
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        return text;
      });
      xAxis.get("renderer").labels.template.setAll({
        fontSize: 11,
        fill: am5.color("#666"),
      });
    }

    // Create value axis
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // Create line series with smooth curve
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: valueField,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "date",
        strokeWidth: 2,
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: interval === 'month' 
            ? "{date.formatDate('MMM yyyy')}: {valueY.formatNumber('#,###')}"
            : "{date.formatDate('MMM dd, yyyy')}: {valueY.formatNumber('#,###')}",
        }),
        // Smooth curve (monotone)
        tension: 0.5,
      })
    );

    // Set color if provided
    if (color) {
      series.strokes.template.setAll({
        stroke: am5.color(color),
      });
      if (showArea) {
        series.fills.template.setAll({
          fill: am5.color(color),
        });
      }
    }

    // Add gradient area fill under the line
    if (showArea) {
      series.fills.template.setAll({
        visible: true,
        fillOpacity: 0.2,
      });
    }

    // Add circle bullets on each data point
    if (showBullets) {
      series.bullets.push(() => {
        return am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 4,
            fill: series.get("fill") || am5.color("#4285f4"),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 2,
          }),
        });
      });
    }

    // Convert Date objects to ISO date strings for amCharts DataProcessor
    // amCharts 5 works best with date strings and a DataProcessor
    const chartData = prepared.map(item => {
      const date = item.date instanceof Date ? item.date : new Date(item.date);
      return {
        date: date.toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        value: item.value,
      };
    });

    // Set up DataProcessor to parse date strings
    series.data.processor = am5.DataProcessor.new(root, {
      dateFormat: "yyyy-MM-dd",
      dateFields: ["date"],
    });

    // Set data
    series.data.setAll(chartData);

    // Create navigator (scrollbar) at the bottom
    // Use simple scrollbar like in existing charts
    chart.set("scrollbarX", am5.Scrollbar.new(root, { 
      orientation: "horizontal" 
    }));

    // Add cursor with crosshair
    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, { 
      xAxis: xAxis,
      behavior: "zoomX",
    }));
    cursor.lineY.set("visible", true);
    cursor.lineX.set("visible", true);

    // Animate
    series.appear(1000, 100);
    chart.appear(1000, 100);

    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [id, data, valueField, dateField, interval, color, showArea, showBullets]);

  // Log data for debugging
  useEffect(() => {
    if (data && data.length > 0) {
      console.log(`SocialBladeChart [${id}] received data:`, data);
      const prepared = prepareChartData(data, valueField, dateField);
      console.log(`SocialBladeChart [${id}] prepared data:`, prepared);
    } else {
      console.log(`SocialBladeChart [${id}] received empty or no data:`, data);
    }
  }, [id, data, valueField, dateField]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return <div id={id} className={className} style={{ width: "100%", height }}></div>;
};

export default SocialBladeChart;

