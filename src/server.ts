import App from '@/app';
import IndexRoute from '@routes/index.route';
import validateEnv from '@utils/validateEnv';

process.on('uncaughtException', function (err) {
  console.error(err);
});

process.on('SIGINT', () => {
  process.exit();
});

validateEnv();

new App([new IndexRoute()]);
