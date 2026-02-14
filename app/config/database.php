<?php

require_once __DIR__ . '/env.php';

class Database
{
    public static function conectar(): PDO
    {
        try {
            $dsn = "mysql:host=" . DB_HOST .
                   ";dbname=" . DB_NAME .
                   ";charset=" . DB_CHARSET;

            $opcoes = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            return new PDO($dsn, DB_USER, DB_PASS, $opcoes);

        } catch (PDOException $e) {

            if (defined('APP_ENV') && APP_ENV === 'production') {
                die('Erro ao conectar ao banco.');
            }

            die('Erro na conexão com o banco: ' . $e->getMessage());
        }
    }
}
