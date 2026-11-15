# FLEX-145 d²-law explanatory model

## Selected model and scope

The model evaluates the classical droplet d² law for the published FLEX-145 methanol droplet only:

`D(t)² = D₀² − Kt`

The NASA presentation has an unresolved internal source conflict. Printed slide 9 identifies Test Point FLEX-145 (methanol, 1.0 atm) and reports D₀ = 3.38 mm, Dext = 1.66 (unit not repeated on slide; parenthetical says visible flame extinction), and K = 0.44 m²/s, with 20% O₂ / 75% CO₂ / 5% N₂. Printed slide 10 identifies FLEX-145 / C01M201 (methanol; Tue, Nov 16, 2010; 763.468 mmHg) and its plot inset reports D₀ = 3.330 mm, Dext = 1.613 mm, Kavg = 0.448 mm²/s, with O₂ 0.199 / N₂ 0.749 / CO₂ 0.050 / He 0.000. The slides appear to refer to the same named test point but conflict on diameters, rate value/units, and diluent order. The presentation does not state that one slide corrects the other. The values are not resolved as canonical FLEX-145 parameters.

The existing d² timeline is retained only as a conditional scenario using slide 10's inset values. Its displayed endpoints retain their source provenance but are explicitly disputed; intermediate diameters and duration are conditional model calculations, not verified FLEX-145 history or reported NASA time measurements. Do not use this scenario as a validated quantitative claim. No raw series, fit interval, or uncertainty is available.

## Units and calculation

Inputs and outputs use SI units. Corpus diameters are converted from millimetres to metres, and the average rate from mm²/s to m²/s. The model duration is `((D₀ − Dext)(D₀ + Dext)) / K`, using factored subtraction for numerical stability. Diameter follows the d² equation until the reported finite extinction diameter. At and after that time the model is terminated and holds that endpoint; it does not extrapolate to a zero-diameter droplet.

Parameter provenance accompanies each evaluation: slide 10 labels the diameters as source values and Kavg as a derived average, with record IDs, NASA source URLs, and locators. Because slide 9 conflicts, they are marked as slide-10-only inputs in Explore and Learn and are not presented as resolved measurements. No values from the slide 9 summary are combined with slide 10 inputs. Generic test fixtures are explicitly illustrative.

## Explore rendering connection

Explore samples `evaluateFlex145Droplet` on the playback/scrub timeline. It maps only the modeled droplet radius to display space as `(diameterM / 2) × 140` arbitrary render units per metre. This display factor is a framing choice, not a physical calibration. The combustion envelope dimensions remain illustrative and are not derived from the droplet model. Its shader uses the playback phase only to stage small fluctuations and a visual fade near the finite endpoint; this does not predict flame size, color, temperature or structure. Intermediate droplet states are model calculations, while the initial and finite extinction diameters are reported endpoints whose source conflict remains unresolved.

The revised renderer may use subtle warm reflections on the droplet as an illustrative visual cue. This is not an incandescent droplet or a measured temperature response. The flame shell's procedural movement is a visual reconstruction, not a FLEX measurement or a prediction made by the d² law. The optional What-if controls allow only an initial diameter of 2–4.5 mm and effective K of 0.25–0.9 mm²/s; both user inputs are hypothetical. The disputed slide-10 extinction endpoint remains fixed and identified as unresolved in either mode.

## Assumptions and limitations

The calculation assumes a spherical droplet and constant effective K within the selected run segment. It does not calculate flame radius, temperature, oxygen/gravity/airflow response, heat release, or flame appearance. A constant d²-law rate may fail during ignition or other unsteady periods, near extinction, or when conditions differ from FLEX-145. The source conflict and unavailable measurement uncertainty remain unresolved. The current calculation is a conditional slide-10 scenario only; it is not a validated predictive simulation, a canonical FLEX-145 trajectory, a general microgravity combustion model, or a fire-safety tool.
