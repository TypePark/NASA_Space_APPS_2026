import TerrainMap3D from "../components/TerrainMap3D";

export default function Map3D() {
  return (
    <main className="page map3d">
      <section className="stack-12">
        <h1 className="title">Cyprus in 3D</h1>
        <p className="lead muted">
          Terrain from the NISAR elevation model with the average rainfall map from NASA GPM IMERG. Press <strong>Start simulation</strong> to let it rain and
          watch the standing water slowly fill the flat hollows. Wetter places fill up more.
        </p>
      </section>
      <TerrainMap3D />
    </main>
  );
}
