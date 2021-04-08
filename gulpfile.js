let project_folder = require("path").basename(__dirname); //папка итоговой сборки
let source_folder = "_src";	 //папка для исходников

let fs = require('fs');

let path = {
	//пути вывода в сборку
	build: {
		html: project_folder + "/",
		css: project_folder + "/css/",
		js : project_folder + "/js/",
		img: project_folder + "/img/",
		fonts : project_folder + "/fonts/",
	},
	//пути исходников
	src: {
		//ВНИМАНИЕ! ИСКЛЮЧАЕМ ДОП ФАЙЛЫ С СИМВОЛОМ _ - ЭТО СЛУЖЕБНЫЕ ФАЙЛЫ - ОТДЕЛЬНЫЕ ХЭДЕР, ФУТЕР
		html: [source_folder + "/*.html", "!" + source_folder + "/_*.html"],
		css: source_folder + "/scss/main.scss",
		js : source_folder + "/js/main.js",
		img: source_folder + "/img/**/*.{jpg,png,ico,svg,webp,gif}",
		fonts : source_folder + "/fonts/*.ttf",
	},
	//пути к файлам, которые будем "слушать" - мгновенно отлавливать изменения в них
	watch: {
		html: source_folder + "/**/*.html",
		css: source_folder + "/scss/**/*.scss",
		js : source_folder + "/js/**/*.js",
		img: source_folder + "/img/**/*.{jpg,png,ico,svg,webp,gif}",
	},
	//удаление папки итоговой сборки после запуска gulp
	clean: "./" + project_folder + "/"
}

//подключение плагинов
let { src, dest } = require('gulp'),
	gulp = require('gulp'),
	browsersync = require("browser-sync").create(), //синхронизация браузера
	fileinclude = require("gulp-file-include"),		//собирает отдельные файлы типа header, footer в один файл
	del = require("del"),							//плагин для удаления папки итоговой сборки после запуска gulp
	scss = require("gulp-sass"),					//плагин для перевода scss в css
	autoprefixer = require("gulp-autoprefixer"),	//плагин автоматически добавляет вендорные автопрефиксы к свойствам
	group_media = require("gulp-group-css-media-queries"), //плагин собирает медиазапросы и группирует их в конец файла - для оптимизации
	clean_css = require("gulp-clean-css"),			//сжатие css файлов
	rename = require("gulp-rename"),				//плагин для переименования файлов
	uglify = require("gulp-uglify-es").default,		//плагин для сжатия js
	imagemin = require("gulp-imagemin"),			//сжимаем картинки без потери качества
	webp = require("gulp-webp"),					//плагин автоматически конвертирует изображания в формат webp и автоматически подключает webp изображаеняи если браузер их поддерживает
	webpcss = require("gulp-webpcss"),				//плагин для подключения webp в css файлы, у меня с ним какие-то проблемы так и не удалось подключить
	webphtml = require("gulp-webp-html"),			//автоматическое подключение webp изображений, т.е. мы в html подключаем просто обычные изображания gulp сам отображет webp если браузер поддерживает
	ttf2woff = require("gulp-ttf2woff"),
	ttf2woff2 = require("gulp-ttf2woff2"),
	fonter = require("gulp-fonter");


function browserSync(params) {		//синхронизация с браузером
	browsersync.init({
		server: {
			baseDir: "./" + project_folder + "/"
		},
		port: 3000,					//порт
		notify: false
	})
}

//функция для работы с html файлами
function html() {
	return src(path.src.html)
		.pipe(fileinclude())		//собираем все файлы в один [через @@include('имя_файла') ]
		.pipe(webphtml())			//подключаем webp автоматически через тег <img> в исходниках галп разворачивает это в конструкицю <picture> в сборке
		.pipe(dest(path.build.html)) //копирование файлов из исходной папки в сборку
		.pipe(browsersync.stream()) //обновление страницы в браузере
}

//обработка scss файлов в css 
function css() {
	return src(path.src.css) // берет исходник style.scss по этому пути
		.pipe(				// обрабатывает исходник в css
			scss({
				outputStyle: "expanded"	//не сжимаем, в развернутом виде возвращаем
			})
		)
		.pipe(group_media())			//оптимизация медиазапросов
		.pipe(							//добавляем автопрефиксер
			autoprefixer({
				overrideBrowserslist: ["last 5 versions"], //браузеры, которые нужно поддерживать
				cascade: true			//стиль написания автопрефиксера
			})
		)
		.pipe(
			webpcss({
				webpClass: '.webp',
				noWebpClass: '.no-webp'
			}))              //так и не удалось подключить этот плагин
		.pipe(dest(path.build.css))		//отправляем готовый css файл в сборку
		.pipe(clean_css())				//после чего сжимаем css файл
		.pipe(
			rename({					//переименовываем файл
				extname: ".min.css"		//в файл с таким расшираением - для сервера, себе оставляем не сжатый - для редактирования
			})							//именно этот файл подключаем в индексную страницу!
		)
		.pipe(dest(path.build.css))		//выгружаем в сборку также и переименованную и минифицированную версию
		.pipe(browsersync.stream())		//обновление страницы в браузере
}

function js() {
	return src(path.src.js)			//забираем исходник по этому пути
		.pipe(fileinclude())		//собираем все файлы в один [через @@include('имя_файла') ]
		.pipe(dest(path.build.js))	 //выгружаем в сборку готовый js, не минифицир.
		.pipe(uglify())				//минифицируем js 
		.pipe(
			rename({				//переименовываем js для создания мин версии
				extname: ".min.js"	//записывем переименов копию под таким именем, в индек страницу подключаем именно этот файл!
			})
		)
		.pipe(dest(path.build.js))		//выгружаем ее в сборку
		.pipe(browsersync.stream())		//обновление страницы в браузере
}

function images() {
	return src(path.src.img) //берем исходники изображений
		.pipe(			//конвертируем изображения в webp
			webp({
				quality: 70
			})
		)
		.pipe(dest(path.build.img)) //выгружаем webp в сборку
		.pipe(src(path.src.img))	//берем исходники изображений
		.pipe(
			imagemin({				//сжимаем изображения
				progressive: true,
				svgoPlugins: [{removeViewBox: false}],
				interlaced: true,
				optimizationLevel: 3 //0 to 7
			})
		)
		.pipe(dest(path.build.img)) //выгружаем изображения (те что подключаются если webp не подключаются)
		.pipe(browsersync.stream())	//обновляем браузер
}

function fonts(params) {
	src(path.src.fonts)  //получаем исходники
		.pipe(ttf2woff())
		.pipe(dest(path.build.fonts));

	return src(path.src.fonts)  //получаем исходники
		.pipe(ttf2woff2())
		.pipe(dest(path.build.fonts));
}

gulp.task('otf2ttf', function(){
	return src([source_folder + '/fonts/*.otf'])
		.pipe(fonter({
			formats: ['ttf']
		}))
		.pipe(dest(source_folder + '/fonts/')); //выгружаем в исходники, все равно потом функция фонтс все обработает
})


function fontsStyle(params) {
	let file_content = fs.readFileSync(source_folder + '/scss/fonts.scss');
	if (file_content == '') {
		fs.writeFile(source_folder + '/scss/fonts.scss', '', cb);
		return fs.readdir(path.build.fonts, function (err, items) {
			if (items) {
				let c_fontname;
				for (var i = 0; i < items.length; i++) {
					let fontname = items[i].split('.');
					fontname = fontname[0];
					if (c_fontname != fontname) {
						fs.appendFile(source_folder + '/scss/fonts.scss', '@include font("' + fontname + '", "' + fontname + '", "400", "normal");\r\n', cb);
					}
					c_fontname = fontname;
				}
			}
		})
	}
}

function cb() { }

//ставим слежку за файлами, чтобы содержимое файлов-исходников автоматичеки обрабатывалось в сборку при сохранении изменений
function watchFiles(params) {
	//в скобках - путь, функция
	gulp.watch([path.watch.html], html);
	gulp.watch([path.watch.css], css);
	gulp.watch([path.watch.js], js);
	gulp.watch([path.watch.img], images);
}

function clean(params) {	//функция для удаления папки dist при перезапуске gulp
	return del(path.clean);
}

//выполняем функции, которые создали выше, процесс выолнения всего файла
let build = gulp.series(clean, gulp.parallel(js, css, html, images, fonts));
let watch=gulp.parallel(build, watchFiles, browserSync);

//"дружим" созданные переменные функций? с галпом
exports.fontsStyle = fontsStyle;
exports.fonts = fonts;
exports.images = images;
exports.js = js;
exports.css = css;
exports.html = html;
exports.build = build;
exports.watch = watch;
exports.default = watch;