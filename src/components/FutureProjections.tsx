import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

const formatMillions = (num) => `${(num / 1_000_000).toFixed(0)}M`;

const FutureProjections = ({ projections, username }: { projections: any[], username: string }) => {
  const chartRef = useRef<am5.Root | null>(null);

  useLayoutEffect(() => {
    // Wait for the DOM to be ready
    const chartContainer = document.getElementById(`projections-chartdiv`);
    if (!chartContainer || !projections || projections.length === 0) return;

    let root = am5.Root.new(`projections-chartdiv`);

    root.setThemes([am5themes_Animated.new(root)]);

    let chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        focusable: true,
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0
      })
    );

    let xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.5,
        groupData: false,
        baseInterval: { timeUnit: "day", count: 1 },
        renderer: am5xy.AxisRendererX.new(root, {
          pan: "zoom",
          minGridDistance: 70,
          minorGridEnabled: true
        }),
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    let yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 1,
        renderer: am5xy.AxisRendererY.new(root, { pan: "zoom" })
      })
    );

    let series = chart.series.push(
      am5xy.LineSeries.new(root, {
        minBulletDistance: 10,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "count",
        valueXField: "date",
        tooltip: am5.Tooltip.new(root, {
          pointerOrientation: "horizontal",
          labelText: "{valueY}"
        })
      })
    );

    series.data.processor = am5.DataProcessor.new(root, {
      dateFormat: "yyyy-MM-dd",
      dateFields: ["date"]
    });
    
    const chartData = projections.map(p => ({
        date: p.date,
        value: p.count
    }));

    series.data.setAll(chartData);

    series.bullets.push(() => {
      let circle = am5.Circle.new(root, {
        radius: 4,
        fill: series.get("fill"),
        stroke: root.interfaceColors.get("background"),
        strokeWidth: 2
      });
      return am5.Bullet.new(root, { sprite: circle });
    });
    
    let cursor = chart.set("cursor", am5xy.XYCursor.new(root, { xAxis: xAxis }));
    cursor.lineY.set("visible", false);

    chart.set("scrollbarX", am5.Scrollbar.new(root, { orientation: "horizontal" }));
    
    series.appear(1000, 100);
    chart.appear(1000, 100);

    chartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [projections]);

  return (
    <div className="mb-8 bg-white rounded-xl p-4">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">Projected Followers for {username}</h3>
      <div id="projections-chartdiv" style={{ width: "100%", height: "500px" }}></div>
    </div>
  );
};

export default FutureProjections; 