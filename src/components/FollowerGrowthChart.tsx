import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

const chartData = [
  { date: "2012-01-01", value: 8 }, { date: "2012-01-02", value: 10 },
  { date: "2012-01-03", value: 12 }, { date: "2012-01-04", value: 14 },
  { date: "2012-01-05", value: 11 }, { date: "2012-01-06", value: 6 },
  { date: "2012-01-07", value: 7 }, { date: "2012-01-08", value: 9 },
  { date: "2012-01-09", value: 13 }, { date: "2012-01-10", value: 15 },
  { date: "2012-01-11", value: 19 }, { date: "2012-01-12", value: 21 },
  { date: "2012-01-13", value: 22 }, { date: "2012-01-14", value: 20 },
  { date: "2012-01-15", value: 18 }, { date: "2012-01-16", value: 14 },
  { date: "2012-01-17", value: 16 }, { date: "2012-01-18", value: 18 },
  { date: "2012-01-19", value: 17 }, { date: "2012-01-20", value: 15 },
  { date: "2012-01-21", value: 12 }, { date: "2012-01-22", value: 10 },
  { date: "2012-01-23", value: 8 }
];

export default function FollowerGrowthChart() {
  const chartRef = useRef<am5.Root | null>(null);

  useLayoutEffect(() => {
    // Wait for the DOM to be ready
    const chartContainer = document.getElementById("historical-chartdiv");
    if (!chartContainer) return;

    let root = am5.Root.new("historical-chartdiv");

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
        valueYField: "value",
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
    
    const createTrendLine = (data: any[], color: am5.Color) => {
        const trendSeries = chart.series.push(
            am5xy.LineSeries.new(root, {
                xAxis: xAxis,
                yAxis: yAxis,
                valueXField: "date",
                stroke: color,
                valueYField: "value"
            })
        );
        trendSeries.data.processor = am5.DataProcessor.new(root, {
            dateFormat: "yyyy-MM-dd",
            dateFields: ["date"]
        });
        trendSeries.data.setAll(data);
        trendSeries.appear(1000, 100);
    }

    createTrendLine(
      [ { date: "2012-01-02", value: 10 }, { date: "2012-01-11", value: 19 } ],
      root.interfaceColors.get("positive") as am5.Color
    );
    createTrendLine(
      [ { date: "2012-01-17", value: 16 }, { date: "2012-01-22", value: 10 } ],
      root.interfaceColors.get("negative") as am5.Color
    );

    let cursor = chart.set("cursor", am5xy.XYCursor.new(root, { xAxis: xAxis }));
    cursor.lineY.set("visible", false);

    chart.set("scrollbarX", am5.Scrollbar.new(root, { orientation: "horizontal" }));
    
    series.appear(1000, 100);
    chart.appear(1000, 100);

    chartRef.current = root;

    return () => {
      root.dispose();
    };
  }, []);

  return (
    <div className="w-full rounded-2xl p-4 bg-white" style={{ height: 400 }}>
        <div id="historical-chartdiv" style={{ width: "100%", height: "100%" }}></div>
    </div>
  );
} 