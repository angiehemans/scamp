import styles from './DrawPreview.module.css';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DrawPreview = ({ x, y, width, height }: Props): JSX.Element => {
  return (
    <div
      className={styles.preview}
      style={{ left: x, top: y, width, height }}
    />
  );
};
