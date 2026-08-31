"use client";

import { CSSProperties, ReactNode, useEffect, useId, useState } from "react";
import styles from "./CircularGauge.module.sass";

export type CircularGaugeProps = {
	/** Current value. Magnitudes beyond `max` wrap around and start a new lap. Negative values wrap the other way around. */
	value: number;
	/** Value that represents one full revolution, in either direction. */
	max?: number;
	/** Outer diameter in px. */
	size?: number;
	textScaling?: number;
	strokeWidth?: number;
	trackColor?: string;
	/** Color of the filled arc/ring and its tip. */
	color?: string;
	/** Sweep in from 0 to `value` on mount instead of rendering at the target value immediately. */
	animateOnMount?: boolean;
	/** Delay (ms) before the mount sweep starts. Ignored unless `animateOnMount`. */
	animateDelayMs?: number;
	/** Duration (ms) of the mount sweep. Ignored unless `animateOnMount`. */
	animateDurationMs?: number;
	/** Appended to the default label, e.g. "%". Ignored when `children` is passed. */
	unit?: string;
	/** Center label font size in px. Defaults to scaling with `size`; set explicitly to grow the ring without growing the label. */
	fontSize?: number;
	showValue?: boolean;
	className?: string;
	/** Overrides the default centered value label. */
	children?: ReactNode;
};

// Keeps the default label from blowing out the gauge's width on outlier
// values — 1234 reads as "1.2k" instead of overflowing past 3 digits.
function formatCompact(n: number): string {
	const rounded = Math.round(n);
	if (Math.abs(rounded) < 1000) return String(rounded);
	return `${(rounded / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export function CircularGauge({
	value,
	max = 100,
	size = 56,
	textScaling = 0.26,
	strokeWidth = 6,
	trackColor = "rgba(127, 127, 127, 0.25)",
	color = "#22e022",
	animateOnMount = false,
	animateDelayMs = 0,
	animateDurationMs = 800,
	unit = "",
	fontSize,
	showValue = true,
	className,
	children,
}: CircularGaugeProps) {
	const radius = (size - strokeWidth) / 2;
	const center = size / 2;
	// The tip rim's own strokeWidth (below) is thick relative to its small
	// radius, so it bleeds past the ring's outer/inner edge - this clips it
	// back to the ring's own annulus so nothing pokes outside the ring band.
	const clipId = useId();

	// Sweeps displayValue from 0 up to `value` once, after `animateDelayMs` -
	// every geometry calculation below reads displayValue rather than `value`
	// directly so the ring and its tip animate in lockstep.
	const [displayValue, setDisplayValue] = useState(animateOnMount ? 0 : value);

	useEffect(() => {
		if (!animateOnMount) {
			setDisplayValue(value);
			return;
		}
		let raf = 0;
		let start = 0;
		const timeout = setTimeout(() => {
			const tick = (now: number) => {
				if (!start) start = now;
				const elapsed = (now - start) / animateDurationMs;
				const eased = 1 - Math.pow(1 - Math.min(elapsed, 1), 3);
				setDisplayValue(value * eased);
				if (elapsed < 1) raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		}, animateDelayMs);
		return () => {
			clearTimeout(timeout);
			cancelAnimationFrame(raf);
		};
	}, [value, animateOnMount, animateDelayMs, animateDurationMs]);

	const sign = displayValue < 0 ? -1 : 1;
	const magnitude = Math.abs(displayValue);
	const laps = Math.floor(magnitude / max);
	const progress = magnitude % max;
	const progressRatio = progress / max;

	// Position on the ring for an absolute angle (radians, clockwise from 12
	// o'clock). Periodic, so angles beyond +-2π wrap to the right spot.
	const pointAt = (a: number) => ({
		x: center + radius * Math.sin(a),
		y: center - radius * Math.cos(a),
	});

	// Angle actually swept by the tip (0..2π), used for its rendered
	// position — full laps don't change where it visually sits.
	const tipAngle = sign * progressRatio * 2 * Math.PI;
	const tip = pointAt(tipAngle);
	const start = pointAt(0);
	const largeArcFlag = progressRatio > 0.5 ? 1 : 0;
	const sweepFlag = sign > 0 ? 1 : 0;
	const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${tip.x} ${tip.y}`;

	const ringOuterRadius = radius + strokeWidth / 2;
	const ringInnerRadius = Math.max(radius - strokeWidth / 2, 0);
	const circleSubpath = (r: number) =>
		`M ${center - r} ${center} A ${r} ${r} 0 1 0 ${center + r} ${center} A ${r} ${r} 0 1 0 ${center - r} ${center} Z`;

	// Once overflowing, the tip dot is drawn in the same flat `color` as the
	// (now fully-lapped) ring behind it, so it'd otherwise vanish. A stroked
	// half-circle rim on the tip's outer-facing side - the side pointing away
	// from ring center - gives it an edge to read against without needing a
	// second color. `<circle>` stroke-dasharray reveals clockwise starting at
	// 3 o'clock (see the ring's own -90deg rotation above for that
	// convention); rotating by (tipAngleDeg - 180) re-centers that first-half
	// dash on the outward direction instead.
	const tipOutlineRadius = strokeWidth / 2;
	const tipOutlineCircumference = 2 * Math.PI * tipOutlineRadius;
	const tipAngleDeg = (tipAngle * 180) / Math.PI;
	const tipOutlineRotation = tipAngleDeg - 90;

	return (
		<div
			className={[styles.wrapper, className].filter(Boolean).join(" ")}
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
			>
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke={trackColor}
					strokeWidth={strokeWidth}
				/>
				{laps > 0 ? (
					<circle
						className={styles.arc}
						cx={center}
						cy={center}
						r={radius}
						fill="none"
						stroke={color}
						strokeWidth={strokeWidth}
					/>
				) : (
					progressRatio > 0 && (
						<path
							className={styles.arc}
							d={arcPath}
							fill="none"
							stroke={color}
							strokeWidth={strokeWidth}
							strokeLinecap="round"
						/>
					)
				)}
			</svg>
			{magnitude > 0 && (
				<svg
					width={size}
					height={size}
					viewBox={`0 0 ${size} ${size}`}
					style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
				>
					<defs>
						{/* Two circle subpaths in one path, cut into an annulus by
						    evenodd - and it has to be `clipRule`, not `fillRule`:
						    inside a clipPath the browser decides inside/outside via
						    clip-rule (default nonzero), a separate property that
						    doesn't fall back to fill-rule. With nonzero and both
						    subpaths wound the same direction, the two circles just
						    union instead of punching a hole - the inner radius was
						    silently ignored. */}
						<clipPath id={clipId}>
							<path clipRule="evenodd" d={`${circleSubpath(ringOuterRadius+0.5)} ${circleSubpath(ringInnerRadius-0.5)}`} />
						</clipPath>
					</defs>
					<g clipPath={`url(#${clipId})`}>
						{/* Marks where the ring is on its current lap once it's wrapped past
						    a full one - without it, a completed overflow ring reads as a plain
						    solid circle with no indication of current position. */}
						{laps > 0 && (
							<circle
								cx={tip.x}
								cy={tip.y}
								r={tipOutlineRadius}
								fill="none"
								stroke="rgb(28, 40, 9)"
								strokeWidth={7}
								strokeDasharray={`${tipOutlineCircumference / 2} ${tipOutlineCircumference / 2}`}
								transform={`rotate(${tipOutlineRotation} ${tip.x} ${tip.y})`}
							/>
						)}
						<circle cx={tip.x} cy={tip.y} r={strokeWidth / 2} fill={color} />
					</g>
				</svg>
			)}
			{showValue && (
				<div
					className={styles.value}
					style={{ fontSize: fontSize ?? size * textScaling }}
				>
					{children ?? `${formatCompact(displayValue)}${unit}`}
				</div>
			)}
		</div>
	);
}
