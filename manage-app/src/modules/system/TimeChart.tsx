import { BarChart } from "@mui/x-charts/BarChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import { LineChart } from "@mui/x-charts/LineChart";
import Typography from "@mui/material/Typography";
import { Card } from "../../shared/cards";

export interface TimePoint {
	/** ISO time */
	t: string;
	/** null: nothing recorded (the first hour after a restart); drawn as a gap */
	v: number | null;
}

const hourLabel = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });

/**
 * One measure over time: a line for levels, bars for counts per hour. The
 * title names the series, so there's no legend.
 */
export function TimeChart({
	title,
	points,
	kind = "line",
	format,
	max,
	reference,
	whole = false,
}: {
	title: string;
	points: TimePoint[];
	kind?: "line" | "bar";
	format: (v: number) => string;
	/** the top of the scale; the highest value when left out */
	max?: number;
	/**
	 * A fixed level drawn as a dashed rule, such as the heap's cap. Only once
	 * the values come within a quarter of it: far above them it would flatten
	 * the line against zero, so it's named under the chart instead.
	 */
	reference?: { value: number; label: string };
	/** counts: ticks on whole numbers only */
	whole?: boolean;
}) {
	const times = points.map((p) => p.t);
	const values = points.map((p) => p.v);
	const highest = Math.max(0, ...values.map((v) => v ?? 0));
	const drawReference = reference && highest >= reference.value / 4;
	const every = Math.max(1, Math.ceil(points.length / 6));
	const xAxis = [
		{
			scaleType: kind === "bar" ? ("band" as const) : ("point" as const),
			data: times,
			valueFormatter: (value: string) => hourLabel(value),
			tickInterval: (_value: string, index: number) => index % every === 0,
		},
	];
	const yAxis = [
		{
			width: 64,
			min: 0,
			tickMinStep: whole ? 1 : undefined,
			max: drawReference ? Math.max(reference.value, highest) : max,
			valueFormatter: (value: number) => format(value),
		},
	];
	const series = [{ data: values, valueFormatter: (v: number | null) => (v === null ? "—" : format(v)), label: title }];

	return (
		<Card title={title}>
			{points.length === 0 ? (
				<Typography variant="body2" color="text.secondary">
					Nothing recorded in this range yet.
				</Typography>
			) : kind === "bar" ? (
				<BarChart height={200} hideLegend grid={{ horizontal: true }} xAxis={xAxis} yAxis={yAxis} series={series} margin={{ left: 0, right: 8 }} />
			) : (
				<LineChart
					height={200}
					hideLegend
					grid={{ horizontal: true }}
					xAxis={xAxis}
					yAxis={yAxis}
					series={series.map((s) => ({ ...s, showMark: false }))}
					margin={{ left: 0, right: 8 }}
				>
					{drawReference && (
						<ChartsReferenceLine
							y={reference.value}
							label={reference.label}
							lineStyle={{ strokeDasharray: "4 4" }}
							labelAlign="end"
						/>
					)}
				</LineChart>
			)}
			{reference && !drawReference && points.length > 0 && (
				<Typography variant="caption" color="text.secondary">
					{reference.label}: {format(reference.value)}
				</Typography>
			)}
		</Card>
	);
}
